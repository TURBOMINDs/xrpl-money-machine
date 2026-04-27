"""Liquidity Execution Engine REST endpoints (read-only + admin trigger)."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from auth import current_user, optional_current_user
from config import settings
from database import get_db
from models import LiquidityExecution, User
from services.liquidity_engine import execute_cycle, _to_dict

router = APIRouter(prefix='/liquidity', tags=['liquidity'])


@router.get('/status')
async def liquidity_status(db: AsyncSession = Depends(get_db)):
    """Public read: current engine config + most recent execution."""
    res = await db.execute(
        select(LiquidityExecution).order_by(desc(LiquidityExecution.created_at)).limit(1)
    )
    last = res.scalar_one_or_none()
    return {
        'dry_run': bool(settings.LIQUIDITY_DRY_RUN or not settings.LIQUIDITY_TREASURY_SEED),
        'has_treasury_seed': bool(settings.LIQUIDITY_TREASURY_SEED),
        'community_wallet': settings.SUBSCRIPTION_DEST_ADDRESS,
        'target_amm_address': settings.LIQUIDITY_TARGET_AMM_ADDRESS or settings.SUBSCRIPTION_DEST_ADDRESS,
        'allocation_xema_pct': float(settings.ALLOCATION_XEMA_PCT),
        'allocation_ops_pct': float(settings.ALLOCATION_OPS_PCT),
        'cron': 'Sunday 20:00 UTC',
        'last_execution': _to_dict(last) if last else None,
    }


@router.get('/executions')
async def list_executions(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(LiquidityExecution).order_by(desc(LiquidityExecution.created_at)).limit(limit)
    )
    rows = res.scalars().all()
    return {'items': [_to_dict(r) for r in rows]}


@router.post('/run-now')
async def run_now(
    user: Optional[User] = Depends(optional_current_user),
    force: bool = Query(False, description='Force a new execution even if one already ran in the last 12h'),
    override_amount: Optional[float] = Query(None, description='Override the weekly_collected total (testing only)'),
):
    """Manually trigger a liquidity-execution cycle.

    Available to any authenticated user in mock/dry-run mode (testing convenience).
    In production you should require admin authentication and feature-flag this.
    """
    if not user and not (settings.LIQUIDITY_DRY_RUN or not settings.LIQUIDITY_TREASURY_SEED):
        raise HTTPException(401, detail='auth required for live runs')
    result = await execute_cycle(force=force, override_amount=override_amount)
    return result
