"""AMM pair tracking routes."""
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from auth import current_user
from database import get_db
from models import AmmPair, Subscription, User
from schemas import AmmPairOut, CreateAmmPairRequest, PairStatsOut
from services.plans import slots_for
from services.price_service import get_xrp_usd
from services.xrpl_service import xrpl_service

router = APIRouter(prefix='/amm', tags=['amm'])


async def _user_slots_used(db: AsyncSession, user_id: str) -> int:
    res = await db.execute(select(AmmPair).where(AmmPair.user_id == user_id))
    return len(res.scalars().all())


async def _user_tier(db: AsyncSession, user_id: str):
    res = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id).order_by(desc(Subscription.created_at))
    )
    sub = res.scalars().first()
    if sub and sub.status in ('trial', 'active'):
        return sub.tier
    return None


@router.get('/pairs', response_model=List[AmmPairOut])
async def list_pairs(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(AmmPair).where(AmmPair.user_id == user.id).order_by(desc(AmmPair.created_at))
    )
    return [AmmPairOut.model_validate(p) for p in res.scalars().all()]


@router.post('/pairs', response_model=AmmPairOut)
async def create_pair(
    body: CreateAmmPairRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    tier = await _user_tier(db, user.id)
    limit = slots_for(tier)
    used = await _user_slots_used(db, user.id)
    if used >= limit:
        raise HTTPException(
            status_code=403,
            detail=f'slot limit reached ({used}/{limit}). Upgrade tier to track more.',
        )
    lp = body.lp_address.strip()
    if not lp.startswith('r') or len(lp) < 25:
        raise HTTPException(400, detail='invalid XRPL address format')
    # check for duplicate
    res = await db.execute(
        select(AmmPair).where(AmmPair.user_id == user.id, AmmPair.lp_address == lp)
    )
    if res.scalar_one_or_none():
        raise HTTPException(409, detail='pair already tracked')
    # fetch from XRPL
    info = await xrpl_service.get_amm_info_by_account(lp)
    pair = AmmPair(user_id=user.id, lp_address=lp, pair_name=body.pair_name)
    if info:
        pair.pair_name = pair.pair_name or info.get('pair_name')
        pair.asset1_code = info.get('asset1_code')
        pair.asset2_code = info.get('asset2_code')
        pair.asset2_issuer = info.get('asset2_issuer')
        pair.reserve_asset1 = info.get('reserve_asset1')
        pair.reserve_asset2 = info.get('reserve_asset2')
        pair.trading_fee_bps = info.get('trading_fee_bps')
        pair.lp_token_supply = info.get('lp_token_supply')
        pair.last_polled_at = datetime.now(timezone.utc)
    else:
        # allow creation even if on-ledger lookup is incomplete (pair may be newly-funded etc.)
        pair.pair_name = pair.pair_name or f"Pair {lp[:10]}…"
    db.add(pair)
    await db.commit()
    await db.refresh(pair)
    return AmmPairOut.model_validate(pair)


@router.delete('/pairs/{pair_id}')
async def delete_pair(
    pair_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(AmmPair).where(AmmPair.id == pair_id, AmmPair.user_id == user.id)
    )
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, detail='not found')
    await db.delete(p)
    await db.commit()
    return {'ok': True}


@router.patch('/pairs/{pair_id}/status')
async def toggle_pair_status(
    pair_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(AmmPair).where(AmmPair.id == pair_id, AmmPair.user_id == user.id)
    )
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, detail='not found')
    p.status = 'paused' if p.status == 'active' else 'active'
    await db.commit()
    return {'id': p.id, 'status': p.status}


@router.get('/pairs/{pair_id}/stats', response_model=PairStatsOut)
async def pair_stats(
    pair_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(AmmPair).where(AmmPair.id == pair_id, AmmPair.user_id == user.id)
    )
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, detail='not found')
    # compute price: reserve_asset2 / reserve_asset1 (XRP per token inverse)
    price_xrp = None
    if p.reserve_asset1 and p.reserve_asset2 and p.reserve_asset1 > 0:
        # Price of asset2 in XRP = reserve1/reserve2
        if p.reserve_asset2 > 0:
            price_xrp = p.reserve_asset1 / p.reserve_asset2
    xrp_usd = await get_xrp_usd()
    price_usd = price_xrp * xrp_usd if price_xrp else None
    return PairStatsOut(
        pair_id=p.id,
        lp_address=p.lp_address,
        price_usd=price_usd,
        price_xrp=price_xrp,
        reserve_asset1=p.reserve_asset1,
        reserve_asset2=p.reserve_asset2,
        trading_fee_bps=p.trading_fee_bps,
        lp_token_supply=p.lp_token_supply,
        volume_24h_xrp=None,
        change_pct_24h=None,
    )


@router.get('/pairs/{pair_id}/chart')
async def pair_chart(
    pair_id: str,
    interval: str = '1h',
    range_: str = '30d',
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return OHLCV candlestick data, computed from real price snapshots when available.

    The OHLC engine collects snapshots every ~30s for tracked AMM pairs. Once enough
    history exists for the requested interval/range, this endpoint returns true OHLCV
    aggregated from those snapshots. While the snapshot store is sparse, it falls back
    to a deterministic synthetic series seeded from the current pool state — the response
    is clearly labeled with `synthetic: true` in that case.
    """
    res = await db.execute(
        select(AmmPair).where(AmmPair.id == pair_id, AmmPair.user_id == user.id)
    )
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, detail='not found')
    from services.ohlc_engine import aggregate_candles
    return await aggregate_candles(db, p, interval=interval, range_label=range_, use_usd=True)
