"""OHLC engine: collects price snapshots for tracked pairs and aggregates them
into candles per timeframe. Falls back to deterministic synthetic data when
insufficient real history exists for the requested range.
"""
import logging
import math
import random
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models import AmmPair, PriceSnapshot
from services.price_service import get_xrp_usd

log = logging.getLogger('ohlc')

# Mapping interval label -> bucket size in seconds
INTERVAL_SECONDS = {
    '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
    '1h': 3600, '4h': 14400, '1d': 86400,
}

RANGE_DAYS = {
    '1d': 1, '7d': 7, '30d': 30, '90d': 90, '1y': 365,
}


async def take_snapshot(session: AsyncSession, pair: AmmPair, xrp_usd: Optional[float] = None) -> Optional[PriceSnapshot]:
    """Compute and store a single price snapshot for a pair."""
    if not (pair.reserve_asset1 and pair.reserve_asset2 and pair.reserve_asset2 > 0):
        return None
    price_xrp = pair.reserve_asset1 / pair.reserve_asset2
    if xrp_usd is None:
        xrp_usd = await get_xrp_usd()
    price_usd = price_xrp * xrp_usd if xrp_usd else None
    snap = PriceSnapshot(
        amm_pair_id=pair.id,
        price_xrp=price_xrp,
        price_usd=price_usd,
        reserve_asset1=pair.reserve_asset1,
        reserve_asset2=pair.reserve_asset2,
        xrp_usd=xrp_usd,
        ts=datetime.now(timezone.utc),
    )
    session.add(snap)
    return snap


async def prune_old_snapshots(session: AsyncSession, retention_days: int = None):
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days or settings.OHLC_RETENTION_DAYS)
    await session.execute(delete(PriceSnapshot).where(PriceSnapshot.ts < cutoff))


def _bucket_ts(ts: datetime, interval_s: int) -> int:
    """Floor ts to bucket boundary, returns unix-ms."""
    epoch = int(ts.timestamp())
    bucket = (epoch // interval_s) * interval_s
    return bucket * 1000


async def aggregate_candles(
    session: AsyncSession,
    pair: AmmPair,
    interval: str,
    range_label: str,
    use_usd: bool = True,
) -> Dict:
    """Build OHLC candles from stored snapshots, falling back to synthetic if too sparse."""
    interval_s = INTERVAL_SECONDS.get(interval, 3600)
    days = RANGE_DAYS.get(range_label, 30)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    res = await session.execute(
        select(PriceSnapshot)
        .where(PriceSnapshot.amm_pair_id == pair.id, PriceSnapshot.ts >= since)
        .order_by(PriceSnapshot.ts.asc())
    )
    snaps: List[PriceSnapshot] = list(res.scalars().all())

    # Bucket aggregation
    buckets: Dict[int, List[PriceSnapshot]] = {}
    for s in snaps:
        b = _bucket_ts(s.ts, interval_s)
        buckets.setdefault(b, []).append(s)

    points = []
    last_close = None
    for b in sorted(buckets.keys()):
        bucket_snaps = buckets[b]
        prices = [(s.price_usd if use_usd and s.price_usd else s.price_xrp) for s in bucket_snaps]
        prices = [p for p in prices if p is not None]
        if not prices:
            continue
        o = prices[0] if last_close is None else last_close
        c = prices[-1]
        h = max(prices)
        low = min(prices)
        # Volume proxy: sum of |delta reserve_asset1| within bucket
        vol = 0.0
        prev_r1 = None
        for s in bucket_snaps:
            if prev_r1 is not None and s.reserve_asset1 is not None:
                vol += abs(s.reserve_asset1 - prev_r1)
            prev_r1 = s.reserve_asset1 if s.reserve_asset1 is not None else prev_r1
        points.append({
            't': b,
            'o': round(float(o), 8),
            'h': round(float(h), 8),
            'l': round(float(low), 8),
            'c': round(float(c), 8),
            'v': round(float(vol), 4),
        })
        last_close = c

    synthetic = False
    # If we have fewer than ~6 candles, blend with synthetic to fill the chart
    if len(points) < 6:
        synthetic = True
        points = _synthetic_points(pair, interval_s, days)

    return {
        'pair_id': pair.id,
        'interval': interval,
        'range': range_label,
        'points': points,
        'synthetic': synthetic,
        'snapshot_count': len(snaps),
    }


def _synthetic_points(pair: AmmPair, interval_s: int, days: int) -> List[Dict]:
    """Deterministic synthetic series based on pair_id seed + current pool ratio."""
    base = 0.0
    if pair.reserve_asset1 and pair.reserve_asset2 and pair.reserve_asset2 > 0:
        base = pair.reserve_asset1 / pair.reserve_asset2
    if not base or base <= 0:
        base = 0.0001
    random.seed(abs(hash(pair.id)) % (2 ** 32))
    now = datetime.now(timezone.utc)
    candles = max(20, min(120, int((days * 86400) // interval_s)))
    points = []
    price = base
    for i in range(candles):
        t_ms = int((now - timedelta(seconds=interval_s * (candles - i))).timestamp() * 1000)
        drift = math.sin(i / 6.0) * 0.01 * price
        noise = (random.random() - 0.5) * 0.015 * price
        o = price
        c = max(0.0000001, price + drift + noise)
        h = max(o, c) * (1 + random.random() * 0.006)
        low = min(o, c) * (1 - random.random() * 0.006)
        vol = max(100.0, 5000 + random.random() * 15000)
        points.append({
            't': t_ms,
            'o': round(o, 8),
            'h': round(h, 8),
            'l': round(low, 8),
            'c': round(c, 8),
            'v': round(vol, 2),
        })
        price = c
    return points
