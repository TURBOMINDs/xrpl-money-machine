"""Background worker: polls tracked AMM pairs, evaluates alerts, emits events."""
import asyncio
import json
import logging
import random
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlalchemy import select, update

from database import db_context
from models import Alert, AlertEvent, AmmPair, OneSignalDevice, User, HolderRankConfig
from services.onesignal_service import onesignal_service
from services.price_service import get_xrp_usd
from services.ranks import classify_rank
from services.xrpl_service import xrpl_service

log = logging.getLogger('worker')

# cache of last seen tx hashes per pair (avoid re-emitting)
_last_seen: Dict[str, set] = {}
# cache last reserve per pair for liquidity surge detection
_last_reserve: Dict[str, float] = {}

WHALE_THRESHOLDS = {
    'shrimp': 500,
    'crab': 2_000,
    'octopus': 7_000,
    'dolphin': 25_000,
    'orca': 50_000,
    'shark': 100_000,
    'whale': 500_000,  # not used directly for alerts
    'humpback': 100_000,  # humpback buys: >= 100k XRP
}


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

    # Whale tx scan
    txs = await xrpl_service.get_recent_transactions(pair.lp_address, limit=20)
    seen = _last_seen.setdefault(pair.id, set())
    new_txs = []
    for tx_entry in txs:
        cls = xrpl_service.classify_tx_buy_sell(tx_entry, pair.lp_address)
        if not cls['hash'] or cls['hash'] in seen:
            continue
        new_txs.append(cls)
        seen.add(cls['hash'])
    # Only first time seeing txs -> don't emit to avoid backfill spam
    if len(seen) == len(new_txs):
        return  # first poll just recorded them

    for c in new_txs:
        xrp_amt = c.get('xrp_amount', 0) or 0
        if xrp_amt < WHALE_THRESHOLDS['crab']:
            continue
        if c['side'] == 'buy' and xrp_amt >= WHALE_THRESHOLDS['humpback']:
            await _emit_event(
                session, user_id=pair.user_id, amm_pair_id=pair.id,
                type_='humpback_buy', severity='critical',
                title='Humpback Buy Alert',
                message=f"{xrp_amt:,.0f} XRP purchased!",
                tx_hash=c['hash'], payload={'xrp': xrp_amt, 'account': c['account']},
            )
        elif c['side'] == 'buy' and xrp_amt >= WHALE_THRESHOLDS['shark']:
            await _emit_event(
                session, user_id=pair.user_id, amm_pair_id=pair.id,
                type_='shark_buy', severity='warning',
                title='Shark Buy Alert',
                message=f"{xrp_amt:,.0f} XRP buy detected",
                tx_hash=c['hash'], payload={'xrp': xrp_amt, 'account': c['account']},
            )
        elif c['side'] == 'sell' and xrp_amt >= WHALE_THRESHOLDS['shark']:
            await _emit_event(
                session, user_id=pair.user_id, amm_pair_id=pair.id,
                type_='shark_sell', severity='critical',
                title='Shark Sell Pressure',
                message=f"Large sell action detected — {xrp_amt:,.0f} XRP",
                tx_hash=c['hash'], payload={'xrp': xrp_amt, 'account': c['account']},
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


async def worker_loop(interval_seconds: int = 30):
    log.info(f'Worker started (interval {interval_seconds}s)')
    while True:
        try:
            await _poll_once()
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
