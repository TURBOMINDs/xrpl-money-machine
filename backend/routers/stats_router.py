"""Public stats: subscription tier counts, weekly support pool, last support action."""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, distinct, desc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Subscription, SupportAction, User

router = APIRouter(prefix='/stats', tags=['stats'])


def _next_sunday_8pm(now: Optional[datetime] = None) -> datetime:
    """Compute the next Sunday at 20:00 UTC (inclusive — if today is Sunday before 20:00, returns today)."""
    now = now or datetime.now(timezone.utc)
    # weekday(): Monday=0, Sunday=6
    days_ahead = (6 - now.weekday()) % 7
    candidate = (now + timedelta(days=days_ahead)).replace(hour=20, minute=0, second=0, microsecond=0)
    if candidate <= now:
        candidate = candidate + timedelta(days=7)
    return candidate


@router.get('/subscriptions')
async def subscription_stats(db: AsyncSession = Depends(get_db)):
    """Return public-facing subscription stats for the Liquidity Support Tracker.

    Counts unique wallet addresses per tier. Wallet addresses themselves are NEVER returned.
    Basic includes both `active` and `trial` subscriptions per spec.
    Plus / Ultimate count only `active` (paid) subscriptions.
    """
    # Most-recent subscription per user — to avoid double-counting users who upgraded.
    # We treat a user as belonging to the highest tier they currently hold (active > trial).
    stmt = (
        select(
            User.xrpl_address,
            Subscription.tier,
            Subscription.status,
            Subscription.created_at,
        )
        .join(Subscription, Subscription.user_id == User.id)
        .where(Subscription.status.in_(('active', 'trial')))
    )
    rows = (await db.execute(stmt)).all()

    # Map wallet -> best (tier, status) where Ultimate > Plus > Basic, active > trial
    tier_priority = {'ultimate': 3, 'plus': 2, 'basic': 1}
    status_priority = {'active': 2, 'trial': 1}
    by_wallet = {}
    for addr, tier, status, _ in rows:
        if not addr:
            continue
        cur = by_wallet.get(addr)
        score = (tier_priority.get(tier, 0), status_priority.get(status, 0))
        if not cur or score > cur['score']:
            by_wallet[addr] = {'tier': tier, 'status': status, 'score': score}

    basic_wallets = sum(1 for v in by_wallet.values() if v['tier'] == 'basic')
    plus_wallets = sum(1 for v in by_wallet.values()
                       if v['tier'] == 'plus' and v['status'] == 'active')
    ultimate_wallets = sum(1 for v in by_wallet.values()
                           if v['tier'] == 'ultimate' and v['status'] == 'active')

    # Weekly XRP collected: paid subscriptions in last 7 days
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    weekly_q = await db.execute(
        select(func.coalesce(func.sum(Subscription.xrp_amount), 0.0)).where(
            and_(
                Subscription.status == 'active',
                Subscription.xrp_amount.isnot(None),
                Subscription.current_period_start >= week_ago,
            )
        )
    )
    weekly_xrp_collected = float(weekly_q.scalar() or 0.0)

    # Last support action
    last_q = await db.execute(
        select(SupportAction).order_by(desc(SupportAction.created_at)).limit(1)
    )
    last_action = last_q.scalar_one_or_none()
    last_payload = (
        {
            'amount_xrp': float(last_action.amount_xrp),
            'timestamp': last_action.created_at.isoformat(),
            'action_type': last_action.action_type,
        }
        if last_action
        else None
    )

    next_cycle_dt = _next_sunday_8pm()

    # Allocation breakdown
    from config import settings as _settings
    xema_pct = float(_settings.ALLOCATION_XEMA_PCT)
    ops_pct = float(_settings.ALLOCATION_OPS_PCT)
    xema_xrp = round(weekly_xrp_collected * (xema_pct / 100.0), 4)
    ops_xrp = round(weekly_xrp_collected * (ops_pct / 100.0), 4)

    return {
        'basic_wallets': basic_wallets,
        'plus_wallets': plus_wallets,
        'ultimate_wallets': ultimate_wallets,
        'weekly_xrp_collected': round(weekly_xrp_collected, 2),
        'next_support_cycle': 'Sunday 8:00 PM',
        'next_support_cycle_at': next_cycle_dt.isoformat(),
        'last_support_action': last_payload,
        'total_unique_wallets': len(by_wallet),
        # Allocation split (for the Liquidity Support Tracker UI)
        'allocation': {
            'xema_pct': xema_pct,
            'ops_pct': ops_pct,
            'xema_support_xrp': xema_xrp,
            'ops_growth_xrp': ops_xrp,
        },
        # Community / dev wallet (public, safe to expose) \u2014 destination of all subscriptions
        'community_wallet': _settings.SUBSCRIPTION_DEST_ADDRESS,
        'dry_run': bool(_settings.LIQUIDITY_DRY_RUN or not _settings.LIQUIDITY_TREASURY_SEED),
    }


@router.get('/support-history')
async def support_history(limit: int = 10, db: AsyncSession = Depends(get_db)):
    """Public ledger of recent support actions (no PII)."""
    res = await db.execute(
        select(SupportAction).order_by(desc(SupportAction.created_at)).limit(min(max(1, limit), 50))
    )
    items = []
    for a in res.scalars().all():
        items.append({
            'id': a.id,
            'amount_xrp': float(a.amount_xrp),
            'action_type': a.action_type,
            'note': a.note,
            'tx_hash': a.tx_hash,
            'created_at': a.created_at.isoformat() if a.created_at else None,
        })
    return {'items': items}
