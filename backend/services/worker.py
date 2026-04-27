"""Background worker: polls tracked AMM pairs, evaluates alerts, emits events.

Now also:
- captures every fresh transaction touching a tracked AMM as `pair_transactions`
- classifies the actor by XRPL balance \u2192 whale rank
- takes periodic OHLC price snapshots (`price_snapshots`)
"""
import asyncio
import json
import logging
import random
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from config import settings
from database import db_context
from models import (
    Alert, AlertEvent, AmmPair, OneSignalDevice, User, HolderRankConfig,
    PairTransaction,
)
from services.onesignal_service import onesignal_service
from services.price_service import get_xrp_usd
from services.ranks import classify_rank
from services.whale_detector import classify_actor, whale_severity
from services.ohlc_engine import take_snapshot, prune_old_snapshots
from services.xrpl_service import xrpl_service

log = logging.getLogger('worker')

# cache of last seen tx hashes per pair (avoid re-emitting)
_last_seen: Dict[str, set] = {}
# cache last reserve per pair for liquidity surge detection
_last_reserve: Dict[str, float] = {}


async def _emit_event(session, *, user_id, amm_pair_id, type_, severity, title, message, tx_hash=None, payload=None):
    evt = AlertEvent(
        id=str(uuid.uuid4()),
        user_id=user_id,
        amm_pair_id=amm_pair_id,
        type=type_,
        severity=severity,
        title=title,
        message=message,
        tx_hash=tx_hash,
        payload_json=json.dumps(payload) if payload else None,
        created_at=datetime.now(timezone.utc),
    )
    session.add(evt)
    # onesignal push to user's devices (mock)
    try:
        res = await session.execute(select(OneSignalDevice.player_id).where(OneSignalDevice.user_id == user_id))
        players = [r[0] for r in res.all()]
        if players:
            await onesignal_service.send_to_players(
                player_ids=players,
                heading=title,
                content=message or '',
                data={'type': type_, 'amm_pair_id': amm_pair_id, 'tx_hash': tx_hash},
            )
    except Exception as e:
        log.debug(f'push failed: {e}')


async def poll_amm_pair(pair: AmmPair, session):
    """Refresh AMM pair stats + detect whale txs + liquidity surges."""
    info = await xrpl_service.get_amm_info_by_account(pair.lp_address)
    if not info:
        log.debug(f'no amm info for {pair.lp_address}')
        return
    # Update pair cached stats
    await session.execute(
        update(AmmPair).where(AmmPair.id == pair.id).values(
            asset1_code=info.get('asset1_code') or pair.asset1_code,
            asset2_code=info.get('asset2_code') or pair.asset2_code,
            asset2_issuer=info.get('asset2_issuer') or pair.asset2_issuer,
            reserve_asset1=info.get('reserve_asset1'),
            reserve_asset2=info.get('reserve_asset2'),
            trading_fee_bps=info.get('trading_fee_bps'),
            lp_token_supply=info.get('lp_token_supply'),
            pair_name=info.get('pair_name') or pair.pair_name,
            last_polled_at=datetime.now(timezone.utc),
        )
    )

    # Liquidity surge check (>=10% change since last poll)
    cur_reserve = float(info.get('reserve_asset1') or 0)
    last = _last_reserve.get(pair.id)
    if last and last > 0:
        pct = ((cur_reserve - last) / last) * 100.0
        if abs(pct) >= 10.0:
            title = 'Liquidity Surge Alert'
            msg = f"AMM pool moved {pct:+.1f}% ({pair.pair_name or pair.lp_address[:10]})"
            await _emit_event(
                session, user_id=pair.user_id, amm_pair_id=pair.id,
                type_='liquidity_surge', severity='warning' if pct > 0 else 'critical',
                title=title, message=msg, payload={'pct': pct, 'new_reserve': cur_reserve},
            )
    _last_reserve[pair.id] = cur_reserve

    # Whale tx scan with rank classification + persistence
    xrp_usd_now = await get_xrp_usd()
    # Take a price snapshot for the pair (refresh fresh `pair` since update above changed reserves)
    res_pair = await session.execute(select(AmmPair).where(AmmPair.id == pair.id))
    fresh_pair = res_pair.scalar_one_or_none()
    if fresh_pair:
        try:
            await take_snapshot(session, fresh_pair, xrp_usd=xrp_usd_now)
        except Exception as e:
            log.debug(f'snapshot failed: {e}')

    txs = await xrpl_service.get_recent_transactions(pair.lp_address, limit=20)
    seen = _last_seen.setdefault(pair.id, set())
    new_txs = []
    for tx_entry in txs:
        cls = xrpl_service.classify_tx_buy_sell(tx_entry, pair.lp_address)
        if not cls['hash'] or cls['hash'] in seen:
            continue
        new_txs.append((cls, tx_entry))
        seen.add(cls['hash'])
    # First-poll baseline: record txs but don't emit alerts (avoid backfill spam)
    is_baseline = (len(seen) == len(new_txs))

    for c, raw in new_txs:
        xrp_amt = c.get('xrp_amount', 0) or 0
        actor_addr = c.get('account')
        # Classify actor (cached)
        actor_info = await classify_actor(actor_addr) if actor_addr else {'address': None, 'balance_xrp': None, 'rank': None}

        # Persist transaction (idempotent on tx_hash unique)
        try:
            session.add(PairTransaction(
                amm_pair_id=pair.id,
                tx_hash=c['hash'],
                tx_type=c.get('type'),
                side=c.get('side'),
                account=actor_addr,
                counterparty=c.get('destination'),
                xrp_amount=float(xrp_amt or 0),
                actor_balance_xrp=actor_info.get('balance_xrp'),
                actor_rank=actor_info.get('rank'),
                ledger_index=(raw.get('tx', {}) or raw.get('tx_json', {}) or {}).get('ledger_index'),
                raw_json=json.dumps(raw)[:8000] if raw else None,
                detected_at=datetime.now(timezone.utc),
            ))
            await session.flush()
        except IntegrityError:
            await session.rollback()
        except Exception as e:
            log.debug(f'failed to persist tx {c.get("hash")}: {e}')

        if is_baseline:
            continue
        # Generate alert event if threshold crossed
        sev = whale_severity(c.get('side'), xrp_amt)
        if not sev:
            continue
        await _emit_event(
            session,
            user_id=pair.user_id,
            amm_pair_id=pair.id,
            type_=sev['type'],
            severity=sev['severity'],
            title=sev['title'],
            message=sev['message_fmt'].format(amt=xrp_amt),
            tx_hash=c['hash'],
            payload={
                'xrp': xrp_amt,
                'account': actor_addr,
                'actor_rank': actor_info.get('rank'),
                'actor_balance_xrp': actor_info.get('balance_xrp'),
            },
        )


async def evaluate_price_alerts(session):
    """Evaluate user price alerts against current XRP/USD and pair price."""
    xrp_usd = await get_xrp_usd()
    res = await session.execute(select(Alert).where(Alert.is_active == True))  # noqa: E712
    for alert in res.scalars().all():
        trigger = False
        msg = None
        if alert.type == 'price_above' and alert.threshold is not None:
            if xrp_usd >= float(alert.threshold):
                trigger = True
                msg = f"XRP price rose to ${xrp_usd:.4f} (threshold ${alert.threshold:.4f})"
        elif alert.type == 'price_below' and alert.threshold is not None:
            if xrp_usd <= float(alert.threshold):
                trigger = True
                msg = f"XRP price fell to ${xrp_usd:.4f} (threshold ${alert.threshold:.4f})"
        if trigger:
            # cooldown 5 min
            now = datetime.now(timezone.utc)
            if alert.last_triggered_at and (now - alert.last_triggered_at).total_seconds() < 300:
                continue
            alert.triggered_count = (alert.triggered_count or 0) + 1
            alert.last_triggered_at = now
            await _emit_event(
                session, user_id=alert.user_id, amm_pair_id=alert.amm_pair_id,
                type_=alert.type, severity='info', title='Price Alert Triggered',
                message=msg, payload={'xrp_usd': xrp_usd, 'threshold': alert.threshold},
            )


async def _poll_once():
    async with db_context() as session:
        try:
            res = await session.execute(select(AmmPair).where(AmmPair.status == 'active'))
            pairs = list(res.scalars().all())
            for p in pairs:
                try:
                    await poll_amm_pair(p, session)
                except Exception as e:
                    log.warning(f'poll_amm_pair {p.id} failed: {e}')
            await evaluate_price_alerts(session)
            await session.commit()
        except Exception as e:
            log.exception(f'worker cycle failed: {e}')
            await session.rollback()


_prune_counter = {'n': 0}


async def worker_loop(interval_seconds: int = 30):
    log.info(f'Worker started (interval {interval_seconds}s)')
    while True:
        try:
            await _poll_once()
            # Prune old snapshots once per ~hour (every 120 polls @ 30s)
            _prune_counter['n'] += 1
            if _prune_counter['n'] % 120 == 0:
                async with db_context() as session:
                    try:
                        await prune_old_snapshots(session)
                        await session.commit()
                    except Exception as e:
                        log.debug(f'prune failed: {e}')
        except Exception as e:
            log.exception(f'worker loop err: {e}')
        await asyncio.sleep(interval_seconds)


async def seed_demo_events(user_id: str, amm_pair_id: str | None = None):
    """Seed some demo alert events so the Live Alerts panel shows content immediately."""
    samples = [
        ('humpback_buy', 'critical', 'Humpback Buy Alert', '100K+ XRP purchased!'),
        ('liquidity_surge', 'warning', 'Liquidity Surge Alert', 'AMM pool up 15%'),
        ('shark_sell', 'critical', 'Shark Sell Pressure', 'Large sell action detected — possible reversal zone'),
        ('shark_buy', 'warning', 'Shark Buy Alert', '35,000 XRP buy detected'),
    ]
    async with db_context() as session:
        for t, sev, title, msg in samples:
            evt = AlertEvent(
                id=str(uuid.uuid4()),
                user_id=user_id,
                amm_pair_id=amm_pair_id,
                type=t,
                severity=sev,
                title=title,
                message=msg,
                tx_hash=f'MOCK{uuid.uuid4().hex[:28].upper()}',
                created_at=datetime.now(timezone.utc),
            )
            session.add(evt)
        await session.commit()
