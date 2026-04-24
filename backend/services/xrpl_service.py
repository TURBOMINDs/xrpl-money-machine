"""XRPL service: AMM info, balances, transactions."""
import asyncio
import logging
from typing import Any, Dict, List, Optional

import httpx
from xrpl.asyncio.clients import AsyncJsonRpcClient
from xrpl.models.requests import AMMInfo, AccountInfo, AccountLines, AccountTx
from xrpl.utils import drops_to_xrp

from config import settings

log = logging.getLogger('xrpl')

KNOWN_CURRENCIES = {
    'USD': 'USD',
    '524C555344000000000000000000000000000000': 'RLUSD',
}


def hex_to_currency(code: str) -> str:
    if not code:
        return code
    if len(code) == 3:
        return code
    # hex-encoded 40-char
    try:
        b = bytes.fromhex(code)
        decoded = b.rstrip(b'\x00').decode('utf-8', errors='ignore').strip()
        return decoded or KNOWN_CURRENCIES.get(code.upper(), code[:8])
    except Exception:
        return KNOWN_CURRENCIES.get(code.upper(), code[:8])


class XRPLService:
    def __init__(self, rpc_url: str = None):
        self.rpc_url = rpc_url or settings.XRPL_RPC_URL
        self.client = AsyncJsonRpcClient(self.rpc_url)

    async def get_account_info(self, address: str) -> Dict[str, Any]:
        try:
            resp = await self.client.request(AccountInfo(account=address, ledger_index='validated'))
            data = resp.result
            if 'account_data' not in data:
                return {'found': False, 'error': data.get('error', 'unknown'), 'xrp_balance': 0.0}
            balance_drops = data['account_data']['Balance']
            xrp = float(drops_to_xrp(balance_drops))
            return {
                'found': True,
                'address': address,
                'xrp_balance': xrp,
                'balance_drops': int(balance_drops),
                'sequence': data['account_data'].get('Sequence'),
                'owner_count': data['account_data'].get('OwnerCount', 0),
            }
        except Exception as e:
            log.warning(f'account_info failed for {address}: {e}')
            return {'found': False, 'error': str(e), 'xrp_balance': 0.0}

    async def get_account_lines(self, address: str) -> List[Dict[str, Any]]:
        try:
            resp = await self.client.request(AccountLines(account=address, ledger_index='validated'))
            return resp.result.get('lines', [])
        except Exception as e:
            log.warning(f'account_lines failed for {address}: {e}')
            return []

    async def get_amm_info_by_account(self, amm_account: str) -> Optional[Dict[str, Any]]:
        """Given the LP/AMM account, try to infer pair by its trustlines + XRP."""
        info = await self.get_account_info(amm_account)
        if not info.get('found'):
            return None
        lines = await self.get_account_lines(amm_account)
        # AMM accounts typically hold 2 balances (native XRP + one token, or two tokens)
        xrp_balance = info['xrp_balance']
        tokens = []
        for line in lines:
            try:
                tokens.append({
                    'currency': line.get('currency'),
                    'currency_name': hex_to_currency(line.get('currency', '')),
                    'issuer': line.get('account'),
                    'balance': float(line.get('balance', 0)),
                })
            except Exception:
                continue
        asset1_code = 'XRP'
        asset1_issuer = None
        reserve_asset1 = xrp_balance
        asset2_code = tokens[0]['currency_name'] if tokens else None
        asset2_issuer = tokens[0]['issuer'] if tokens else None
        reserve_asset2 = tokens[0]['balance'] if tokens else None
        # Try AMMInfo by asset pair for more detail
        lp_token_supply = None
        trading_fee_bps = None
        if asset2_code and asset2_issuer:
            try:
                asset2_hex = tokens[0]['currency']
                req = AMMInfo(
                    asset={'currency': 'XRP'},
                    asset2={'currency': asset2_hex, 'issuer': asset2_issuer},
                )
                resp = await self.client.request(req)
                amm = resp.result.get('amm', {})
                if amm:
                    lp_token_supply = float(amm.get('lp_token', {}).get('value', 0) or 0) or None
                    trading_fee_bps = int(amm.get('trading_fee', 0) or 0) or None
            except Exception as e:
                log.debug(f'amm_info lookup failed: {e}')
        return {
            'amm_account': amm_account,
            'asset1_code': asset1_code,
            'asset1_issuer': asset1_issuer,
            'asset2_code': asset2_code,
            'asset2_issuer': asset2_issuer,
            'reserve_asset1': reserve_asset1,
            'reserve_asset2': reserve_asset2,
            'lp_token_supply': lp_token_supply,
            'trading_fee_bps': trading_fee_bps,
            'pair_name': f"{asset1_code}/{asset2_code or 'UNKNOWN'}",
        }

    async def get_recent_transactions(self, address: str, limit: int = 25) -> List[Dict[str, Any]]:
        try:
            resp = await self.client.request(AccountTx(account=address, limit=limit, ledger_index_min=-1, ledger_index_max=-1))
            return resp.result.get('transactions', [])
        except Exception as e:
            log.warning(f'account_tx failed for {address}: {e}')
            return []

    def classify_tx_buy_sell(self, tx_entry: Dict[str, Any], amm_account: str) -> Dict[str, Any]:
        """Very simple heuristic: if Destination == amm or Account == amm with XRP Amount."""
        tx = tx_entry.get('tx', {}) or tx_entry.get('tx_json', {})
        tx_type = tx.get('TransactionType')
        amount = tx.get('Amount')
        account = tx.get('Account')
        destination = tx.get('Destination')
        side = None
        xrp_amt = 0.0
        if isinstance(amount, str):
            try:
                xrp_amt = float(drops_to_xrp(amount))
            except Exception:
                xrp_amt = 0.0
        if tx_type == 'Payment':
            if destination == amm_account:
                side = 'buy'  # XRP into pool => likely buying the other asset
            elif account == amm_account:
                side = 'sell'
        return {
            'hash': tx.get('hash') or tx_entry.get('hash'),
            'type': tx_type,
            'account': account,
            'destination': destination,
            'xrp_amount': xrp_amt,
            'side': side,
        }

    async def verify_payment(self, tx_hash: str, expected_dest: str, min_xrp: float) -> Dict[str, Any]:
        """Verify a Payment transaction on ledger. Returns {ok, xrp_amount, account}."""
        try:
            async with httpx.AsyncClient(timeout=10) as hc:
                r = await hc.post(self.rpc_url, json={
                    'method': 'tx',
                    'params': [{'transaction': tx_hash, 'binary': False}],
                })
                data = r.json().get('result', {})
            if data.get('status') != 'success' and 'error' in data:
                return {'ok': False, 'reason': data.get('error_message', 'not_found')}
            if data.get('TransactionType') != 'Payment':
                return {'ok': False, 'reason': 'not_payment'}
            if data.get('Destination') != expected_dest:
                return {'ok': False, 'reason': 'wrong_destination'}
            amt = data.get('Amount')
            if not isinstance(amt, str):
                return {'ok': False, 'reason': 'not_xrp'}
            xrp = float(drops_to_xrp(amt))
            if xrp + 0.001 < min_xrp:
                return {'ok': False, 'reason': 'insufficient_amount', 'xrp_amount': xrp}
            return {'ok': True, 'xrp_amount': xrp, 'account': data.get('Account')}
        except Exception as e:
            return {'ok': False, 'reason': str(e)}


xrpl_service = XRPLService()
