"""Mock + real Xaman (XUMM) service."""
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import httpx

from config import settings

log = logging.getLogger('xaman')

XAMAN_API_BASE = 'https://xumm.app/api/v1/platform'


class XamanService:
    def __init__(self):
        self.api_key = settings.XAMAN_API_KEY
        self.api_secret = settings.XAMAN_API_SECRET
        self.mock = settings.XAMAN_MOCK_MODE
        # in-memory store for mock payloads
        self._mock_store: Dict[str, Dict[str, Any]] = {}

    # ─── public api ───────────────────────────────────────────────────
    async def create_signin_payload(self, return_url: str) -> Dict[str, Any]:
        if self.mock:
            return self._mock_signin(return_url)
        payload = {
            'txjson': {'TransactionType': 'SignIn'},
            'options': {'submit': False, 'expire': 10, 'return_url': {'web': return_url, 'app': return_url}},
            'custom_meta': {'instruction': 'Sign in to XRPL Universal Money Machine'},
        }
        return await self._post_payload(payload)

    async def create_payment_payload(
        self, destination: str, amount_xrp: float, return_url: str, memo: Optional[str] = None
    ) -> Dict[str, Any]:
        if self.mock:
            return self._mock_payment(destination, amount_xrp, return_url, memo)
        drops = str(int(round(amount_xrp * 1_000_000)))
        txjson: Dict[str, Any] = {
            'TransactionType': 'Payment',
            'Destination': destination,
            'Amount': drops,
        }
        if memo:
            txjson['Memos'] = [
                {'Memo': {'MemoData': memo.encode('utf-8').hex().upper(), 'MemoType': '696E74656E74'}},
            ]
        payload = {
            'txjson': txjson,
            'options': {'submit': True, 'expire': 30, 'return_url': {'web': return_url, 'app': return_url}},
            'custom_meta': {'instruction': f'Send {amount_xrp:.2f} XRP to activate subscription', 'identifier': memo or ''},
        }
        return await self._post_payload(payload)

    async def get_payload_status(self, payload_uuid: str) -> Dict[str, Any]:
        if self.mock:
            return self._mock_status(payload_uuid)
        headers = self._auth_headers()
        async with httpx.AsyncClient(timeout=10) as hc:
            r = await hc.get(f'{XAMAN_API_BASE}/payload/{payload_uuid}', headers=headers)
            if r.status_code != 200:
                return {'error': r.text, 'status_code': r.status_code}
            data = r.json()
        meta = data.get('meta', {})
        response = data.get('response', {}) or {}
        return {
            'uuid': payload_uuid,
            'status': 'signed' if meta.get('signed') else ('expired' if meta.get('expired') else 'pending'),
            'signed': bool(meta.get('signed')),
            'address': response.get('account'),
            'user_token': response.get('user'),
            'tx_hash': response.get('txid'),
            'raw': data,
        }

    def resolve_mock(self, payload_uuid: str, address: str, tx_hash: Optional[str] = None) -> Dict[str, Any]:
        if payload_uuid not in self._mock_store:
            raise KeyError('payload not found')
        p = self._mock_store[payload_uuid]
        p['status'] = 'signed'
        p['signed'] = True
        p['address'] = address
        p['tx_hash'] = tx_hash or f'MOCKTX{uuid.uuid4().hex[:24].upper()}'
        return self._mock_status(payload_uuid)

    # ─── mock internals ───────────────────────────────────────────────
    def _mock_signin(self, return_url: str) -> Dict[str, Any]:
        pid = str(uuid.uuid4())
        self._mock_store[pid] = {
            'uuid': pid,
            'purpose': 'signin',
            'status': 'pending',
            'signed': False,
            'address': None,
            'return_url': return_url,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'expires_at': (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        }
        return {
            'payload_uuid': pid,
            'qr_url': f'https://xumm.app/sign/{pid}',
            'deeplink': f'xumm://xumm.app/sign/{pid}',
            'status': 'pending',
        }

    def _mock_payment(self, destination: str, amount_xrp: float, return_url: str, memo: Optional[str]) -> Dict[str, Any]:
        pid = str(uuid.uuid4())
        self._mock_store[pid] = {
            'uuid': pid,
            'purpose': 'payment',
            'status': 'pending',
            'signed': False,
            'address': None,
            'destination': destination,
            'amount_xrp': amount_xrp,
            'memo': memo,
            'return_url': return_url,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'expires_at': (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
        }
        return {
            'payload_uuid': pid,
            'qr_url': f'https://xumm.app/sign/{pid}',
            'deeplink': f'xumm://xumm.app/sign/{pid}',
            'status': 'pending',
        }

    def _mock_status(self, payload_uuid: str) -> Dict[str, Any]:
        p = self._mock_store.get(payload_uuid)
        if not p:
            return {'uuid': payload_uuid, 'status': 'unknown', 'signed': False}
        return {
            'uuid': payload_uuid,
            'status': p['status'],
            'signed': p['signed'],
            'address': p.get('address'),
            'tx_hash': p.get('tx_hash'),
            'user_token': None,
            'purpose': p.get('purpose'),
        }

    # ─── real internals ───────────────────────────────────────────────
    async def _post_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        headers = self._auth_headers()
        async with httpx.AsyncClient(timeout=10) as hc:
            r = await hc.post(f'{XAMAN_API_BASE}/payload', headers=headers, json=payload)
            if r.status_code not in (200, 201):
                raise RuntimeError(f'Xaman payload create failed: {r.status_code} {r.text}')
            data = r.json()
        return {
            'payload_uuid': data['uuid'],
            'qr_url': data['refs']['qr_png'],
            'deeplink': data['next']['always'],
            'status': 'pending',
        }

    def _auth_headers(self) -> Dict[str, str]:
        return {
            'X-API-Key': self.api_key,
            'X-API-Secret': self.api_secret,
            'Content-Type': 'application/json',
        }


xaman_service = XamanService()
