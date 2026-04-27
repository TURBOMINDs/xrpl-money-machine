"""Enhanced whale detection: classify XRPL accounts and tag transactions by rank.

Wraps the basic ranks classifier with a TTL cache to avoid hammering the XRPL
node when many transactions involve the same wallets.
"""
import asyncio
import logging
import time
from typing import Dict, Optional, Tuple

from config import settings
from services.ranks import classify_rank
from services.xrpl_service import xrpl_service

log = logging.getLogger('whale')

_BALANCE_TTL = 300.0  # 5 min cache
_balance_cache: Dict[str, Tuple[float, float]] = {}  # addr -> (balance, ts)
_lock = asyncio.Lock()


async def get_balance_cached(address: str) -> Optional[float]:
    if not address or not address.startswith('r'):
        return None
    now = time.time()
    cached = _balance_cache.get(address)
    if cached and (now - cached[1] < _BALANCE_TTL):
        return cached[0]
    try:
        info = await xrpl_service.get_account_info(address)
        if info.get('found'):
            bal = float(info.get('xrp_balance') or 0.0)
            _balance_cache[address] = (bal, now)
            return bal
    except Exception as e:
        log.debug(f'balance fetch failed for {address}: {e}')
    return None


async def classify_actor(address: str) -> Dict[str, Optional[float]]:
    bal = await get_balance_cached(address)
    rank = classify_rank(bal or 0.0)
    return {'address': address, 'balance_xrp': bal, 'rank': rank}


def whale_severity(side: str, xrp_amount: float) -> Optional[Dict[str, str]]:
    """Decide if a transaction crosses an alert threshold and return classification.

    Returns dict with {type, severity, title, message} or None.
    """
    a = xrp_amount or 0.0
    if a >= settings.WHALE_HUMPBACK_XRP and side == 'buy':
        return {'type': 'humpback_buy', 'severity': 'critical',
                'title': 'Humpback Buy Alert', 'message_fmt': '{amt:,.0f} XRP purchased!'}
    if a >= settings.WHALE_HUMPBACK_XRP and side == 'sell':
        return {'type': 'humpback_sell', 'severity': 'critical',
                'title': 'Humpback Sell Pressure', 'message_fmt': '{amt:,.0f} XRP sell detected'}
    if a >= settings.WHALE_SHARK_XRP and side == 'buy':
        return {'type': 'shark_buy', 'severity': 'warning',
                'title': 'Shark Buy Alert', 'message_fmt': '{amt:,.0f} XRP buy detected'}
    if a >= settings.WHALE_SHARK_XRP and side == 'sell':
        return {'type': 'shark_sell', 'severity': 'critical',
                'title': 'Shark Sell Pressure',
                'message_fmt': 'Large sell action — {amt:,.0f} XRP'}
    if a >= settings.WHALE_DOLPHIN_XRP and side == 'buy':
        return {'type': 'dolphin_buy', 'severity': 'info',
                'title': 'Dolphin Buy', 'message_fmt': '{amt:,.0f} XRP buy'}
    if a >= settings.WHALE_DOLPHIN_XRP and side == 'sell':
        return {'type': 'dolphin_sell', 'severity': 'info',
                'title': 'Dolphin Sell', 'message_fmt': '{amt:,.0f} XRP sell'}
    return None
