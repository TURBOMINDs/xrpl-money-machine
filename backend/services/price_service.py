"""Price service: XRP/USD + token price helpers with multi-source fallback."""
import asyncio
import logging
import time
from typing import Dict, Optional

import httpx

log = logging.getLogger('price')

_cache: Dict[str, Dict[str, float]] = {}
_CACHE_TTL = 30.0  # seconds


async def get_xrp_usd() -> float:
    now = time.time()
    c = _cache.get('xrp_usd')
    if c and now - c['t'] < _CACHE_TTL:
        return c['v']

    sources = [
        ('Bitstamp', 'https://www.bitstamp.net/api/v2/ticker/xrpusd/', lambda d: float(d['last'])),
        ('Kraken', 'https://api.kraken.com/0/public/Ticker?pair=XRPUSD', lambda d: float(list(d['result'].values())[0]['c'][0])),
        ('CoinCap', 'https://api.coincap.io/v2/assets/xrp', lambda d: float(d['data']['priceUsd'])),
    ]
    async with httpx.AsyncClient(timeout=8, headers={'User-Agent': 'XRPL-UMM/1.0'}) as hc:
        for name, url, extractor in sources:
            try:
                r = await hc.get(url)
                if r.status_code != 200:
                    continue
                price = extractor(r.json())
                if 0 < price < 1000:
                    _cache['xrp_usd'] = {'v': price, 't': now}
                    return price
            except Exception as e:
                log.debug(f'{name} xrp_usd failed: {e}')
                continue
    # last resort fallback
    return _cache.get('xrp_usd', {}).get('v', 0.55)


async def usd_to_xrp(usd: float) -> float:
    price = await get_xrp_usd()
    if price <= 0:
        return usd / 0.55
    return usd / price
