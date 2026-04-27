"""XEMA Liquidity Execution Engine.

Runs weekly (Sunday 20:00 UTC). Reads weekly_xrp_collected, applies the
allocation split (default 65% XEMA / 35% ops), and submits an XRPL transaction
to the configured XEMA AMM (or a buyback Payment if no AMM target is set).

Safety:
- DRY_RUN mode is the default until LIQUIDITY_TREASURY_SEED is provided.
- Real signing uses xrpl-py server-side; the seed never leaves the backend.
- Every cycle persists a `liquidity_executions` row with full status & log.
- A successful execution also writes a `support_actions` row that the public
  Liquidity Support Tracker UI consumes.
"""
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import db_context
from models import LiquidityExecution, Subscription, SupportAction

log = logging.getLogger('liquidity')


async def compute_weekly_collected(session: AsyncSession,
                                   cycle_start: datetime, cycle_end: datetime) -> float:
    """Sum xrp_amount of `active` paid subscriptions that landed in [cycle_start, cycle_end)."""
    res = await session.execute(
        select(func.coalesce(func.sum(Subscription.xrp_amount), 0.0)).where(
            Subscription.status == 'active',
            Subscription.xrp_amount.isnot(None),
            Subscription.current_period_start >= cycle_start,
            Subscription.current_period_start < cycle_end,
        )
    )
    return float(res.scalar() or 0.0)


def previous_sunday_8pm(now: Optional[datetime] = None) -> datetime:
    """Return the most-recent past Sunday at 20:00 UTC (the start of the cycle that ends *now*)."""
    now = now or datetime.now(timezone.utc)
    # Go back to most recent Sunday 20:00
    days_back = (now.weekday() - 6) % 7  # Sunday is 6
    candidate = (now - timedelta(days=days_back)).replace(hour=20, minute=0, second=0, microsecond=0)
    if candidate > now:
        candidate = candidate - timedelta(days=7)
    return candidate


async def execute_cycle(force: bool = False, override_amount: Optional[float] = None) -> Dict:
    """Run one execution cycle. Returns the persisted LiquidityExecution row as dict."""
    cycle_end = datetime.now(timezone.utc)
    cycle_start = cycle_end - timedelta(days=7)
    log_lines = []
    log_lines.append(f'cycle_start={cycle_start.isoformat()} cycle_end={cycle_end.isoformat()}')

    async with db_context() as session:
        # Avoid duplicate execution within the same Sunday window unless force=True
        if not force:
            recent = await session.execute(
                select(LiquidityExecution)
                .where(LiquidityExecution.cycle_end >= (cycle_end - timedelta(hours=12)))
                .order_by(desc(LiquidityExecution.cycle_end))
                .limit(1)
            )
            existing = recent.scalar_one_or_none()
            if existing and existing.status not in ('failed',):
                log.info(f'liquidity cycle already executed {existing.id} status={existing.status} — skipping')
                return _to_dict(existing)

        weekly = override_amount if override_amount is not None else await compute_weekly_collected(
            session, cycle_start, cycle_end
        )
        xema_pct = settings.ALLOCATION_XEMA_PCT
        ops_pct = settings.ALLOCATION_OPS_PCT
        xema_xrp = round(weekly * (xema_pct / 100.0), 6)
        ops_xrp = round(weekly * (ops_pct / 100.0), 6)
        log_lines.append(f'weekly_collected={weekly:.4f} XRP -> XEMA {xema_xrp} ({xema_pct}%) / ops {ops_xrp} ({ops_pct}%)')

        execution = LiquidityExecution(
            id=str(uuid.uuid4()),
            cycle_start=cycle_start,
            cycle_end=cycle_end,
            weekly_collected_xrp=weekly,
            allocated_xema_xrp=xema_xrp,
            allocated_ops_xrp=ops_xrp,
            allocation_xema_pct=xema_pct,
            allocation_ops_pct=ops_pct,
            dest_amm_address=settings.LIQUIDITY_TARGET_AMM_ADDRESS or settings.SUBSCRIPTION_DEST_ADDRESS,
            dry_run=settings.LIQUIDITY_DRY_RUN or not settings.LIQUIDITY_TREASURY_SEED,
            status='pending',
            created_at=datetime.now(timezone.utc),
        )
        session.add(execution)
        await session.flush()

        # Skip when nothing to execute
        if xema_xrp <= 0:
            execution.status = 'skipped'
            execution.log = 'No XRP collected this cycle. Skipping.'
            execution.completed_at = datetime.now(timezone.utc)
            log_lines.append(execution.log)
            execution.log = '\n'.join(log_lines)
            await session.commit()
            return _to_dict(execution)

        if execution.dry_run:
            mock_hash = f'DRYRUN{uuid.uuid4().hex[:26].upper()}'
            execution.tx_hash = mock_hash
            execution.treasury_account = 'DRY_RUN_NO_KEY'
            execution.status = 'dry_run'
            execution.completed_at = datetime.now(timezone.utc)
            log_lines.append(
                f'DRY RUN: would send {xema_xrp} XRP to {execution.dest_amm_address}. '
                f'No on-chain submission performed.'
            )
            execution.log = '\n'.join(log_lines)
            # Persist a SupportAction row so the public Liquidity Tracker UI updates
            session.add(SupportAction(
                id=str(uuid.uuid4()),
                amount_xrp=xema_xrp,
                action_type='liquidity_add_dry_run',
                tx_hash=mock_hash,
                note=f'Dry-run weekly XEMA support ({xema_pct}% of {weekly:.2f} XRP)',
                created_at=datetime.now(timezone.utc),
            ))
            await session.commit()
            log.info(log_lines[-1])
            return _to_dict(execution)

        # Real signing path
        try:
            from xrpl.wallet import Wallet
            from xrpl.models.transactions import Payment
            from xrpl.asyncio.transaction import autofill_and_sign, submit_and_wait
            from xrpl.utils import xrp_to_drops
            from xrpl.asyncio.clients import AsyncJsonRpcClient

            client = AsyncJsonRpcClient(settings.XRPL_RPC_URL)
            wallet = Wallet.from_seed(settings.LIQUIDITY_TREASURY_SEED)
            execution.treasury_account = wallet.classic_address
            log_lines.append(f'treasury={wallet.classic_address} target={execution.dest_amm_address}')

            payment = Payment(
                account=wallet.classic_address,
                destination=execution.dest_amm_address,
                amount=xrp_to_drops(xema_xrp),
            )
            signed = await autofill_and_sign(payment, client, wallet)
            log_lines.append(f'signed tx_hash={signed.get_hash()}')
            execution.status = 'submitted'
            await session.flush()
            result = await submit_and_wait(signed, client)
            tx_hash = signed.get_hash()
            ok = result.is_successful() if hasattr(result, 'is_successful') else True
            execution.tx_hash = tx_hash
            execution.status = 'success' if ok else 'failed'
            execution.completed_at = datetime.now(timezone.utc)
            log_lines.append(f'on-ledger result: {execution.status} tx={tx_hash}')

            if ok:
                session.add(SupportAction(
                    id=str(uuid.uuid4()),
                    amount_xrp=xema_xrp,
                    action_type='liquidity_add',
                    tx_hash=tx_hash,
                    note=f'Weekly XEMA support ({xema_pct}% of {weekly:.2f} XRP)',
                    created_at=datetime.now(timezone.utc),
                ))
                # Broadcast push to all subscribed users
                try:
                    from services.onesignal_service import onesignal_service
                    await onesignal_service.broadcast(
                        heading='XEMA Liquidity Injection',
                        content=f'{xema_xrp:.2f} XRP injected into XEMA AMM ({xema_pct}% of weekly).',
                        data={'kind': 'liquidity_executed', 'amount_xrp': xema_xrp, 'tx_hash': tx_hash},
                    )
                except Exception as _:
                    pass
            execution.log = '\n'.join(log_lines)
            await session.commit()
            log.info('Liquidity cycle complete: %s %s XRP -> %s', execution.status, xema_xrp, execution.dest_amm_address)
            return _to_dict(execution)
        except Exception as e:
            execution.status = 'failed'
            execution.error = str(e)[:500]
            execution.completed_at = datetime.now(timezone.utc)
            log_lines.append(f'EXCEPTION: {e}')
            execution.log = '\n'.join(log_lines)
            log.exception('Liquidity execution failed')
            await session.commit()
            return _to_dict(execution)


def _to_dict(e: LiquidityExecution) -> Dict:
    status = e.status
    executed = status in ('success', 'dry_run')
    return {
        'id': e.id,
        'cycle_start': e.cycle_start.isoformat() if e.cycle_start else None,
        'cycle_end': e.cycle_end.isoformat() if e.cycle_end else None,
        'weekly_collected_xrp': float(e.weekly_collected_xrp or 0),
        'allocated_xema_xrp': float(e.allocated_xema_xrp or 0),
        'allocated_ops_xrp': float(e.allocated_ops_xrp or 0),
        'allocation_xema_pct': float(e.allocation_xema_pct or 0),
        'allocation_ops_pct': float(e.allocation_ops_pct or 0),
        'dest_amm_address': e.dest_amm_address,
        'treasury_account': e.treasury_account,
        'tx_hash': e.tx_hash,
        'status': status,
        'dry_run': bool(e.dry_run),
        'error': e.error,
        'log': e.log,
        'created_at': e.created_at.isoformat() if e.created_at else None,
        'completed_at': e.completed_at.isoformat() if e.completed_at else None,
        # Convenience shape requested by ops/UI
        'executed': executed,
        'allocation': {
            'xema': float(e.allocated_xema_xrp or 0),
            'ops': float(e.allocated_ops_xrp or 0),
            'xema_pct': float(e.allocation_xema_pct or 0),
            'ops_pct': float(e.allocation_ops_pct or 0),
        },
    }
