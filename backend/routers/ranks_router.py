"""Holder/rank preferences + utilities."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import current_user
from database import get_db
from models import HolderRankConfig, User
from schemas import RankConfigIn, RankConfigOut
from services.ranks import all_ranks, classify_rank
from services.xrpl_service import xrpl_service

router = APIRouter(prefix='/ranks', tags=['ranks'])


@router.get('/definitions')
async def rank_definitions():
    return {'ranks': all_ranks()}


@router.get('/classify/{address}')
async def classify_address(address: str):
    info = await xrpl_service.get_account_info(address)
    if not info.get('found'):
        raise HTTPException(404, detail='account not found on XRPL')
    rank = classify_rank(info['xrp_balance'])
    return {
        'address': address,
        'xrp_balance': info['xrp_balance'],
        'rank': rank,
    }


@router.get('/config', response_model=List[RankConfigOut])
async def list_rank_config(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(HolderRankConfig).where(HolderRankConfig.user_id == user.id))
    rows = res.scalars().all()
    known = {r.rank: r for r in rows}
    # ensure all 8 ranks exist for the user (create on first access)
    default = ['shrimp', 'crab', 'octopus', 'dolphin', 'orca', 'shark', 'whale', 'humpback']
    new_created = False
    for rn in default:
        if rn not in known:
            cfg = HolderRankConfig(user_id=user.id, rank=rn, price_alerts=False, activity_alerts=True)
            db.add(cfg)
            known[rn] = cfg
            new_created = True
    if new_created:
        await db.commit()
    # refresh rows to return
    res2 = await db.execute(select(HolderRankConfig).where(HolderRankConfig.user_id == user.id))
    return [RankConfigOut.model_validate(r) for r in res2.scalars().all()]


@router.post('/config', response_model=RankConfigOut)
async def upsert_rank_config(
    body: RankConfigIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(HolderRankConfig).where(HolderRankConfig.user_id == user.id, HolderRankConfig.rank == body.rank)
    )
    cfg = res.scalar_one_or_none()
    if not cfg:
        cfg = HolderRankConfig(user_id=user.id, rank=body.rank)
        db.add(cfg)
    cfg.price_alerts = body.price_alerts
    cfg.activity_alerts = body.activity_alerts
    await db.commit()
    await db.refresh(cfg)
    return RankConfigOut.model_validate(cfg)
