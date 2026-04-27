"""System/operational endpoints: readiness, version, configuration introspection."""
from datetime import datetime, timezone
from typing import Dict

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import LiquidityExecution, OneSignalDevice, XamanSession

router = APIRouter(prefix='/system', tags=['system'])


def _has_real_xaman_keys() -> bool:
    k = (settings.XAMAN_API_KEY or '').strip()
    s = (settings.XAMAN_API_SECRET or '').strip()
    return bool(k) and not k.startswith('mock') and bool(s) and not s.startswith('mock')


def _has_real_onesignal_keys() -> bool:
    a = (settings.ONESIGNAL_APP_ID or '').strip()
    r = (settings.ONESIGNAL_REST_API_KEY or '').strip()
    return bool(a) and not a.startswith('mock') and bool(r) and not r.startswith('mock')


@router.get('/readiness')
async def readiness(db: AsyncSession = Depends(get_db)) -> Dict:
    """Production-readiness diagnostic. Reports which integrations are live
    and whether the platform is safe to launch publicly."""
    xaman_live = bool(not settings.XAMAN_MOCK_MODE and _has_real_xaman_keys())

    # Webhook is considered "configured" if EITHER the operator has flipped
    # the env flag XAMAN_WEBHOOK_REGISTERED=true OR we have observed a real
    # webhook delivery from Xaman (a row whose webhook_event_id does NOT start
    # with 'self-test-').
    webhook_configured = bool(settings.XAMAN_WEBHOOK_REGISTERED)
    if not webhook_configured:
        try:
            res = await db.execute(
                select(func.count(XamanSession.id)).where(
                    XamanSession.webhook_event_id.isnot(None),
                    ~XamanSession.webhook_event_id.like('self-test-%'),
                )
            )
            real_webhooks = int(res.scalar() or 0)
            webhook_configured = real_webhooks > 0
        except Exception:
            real_webhooks = 0
    else:
        real_webhooks = None

    onesignal_live = bool(not settings.ONESIGNAL_MOCK_MODE and _has_real_onesignal_keys())
    onesignal_app_id_set = bool((settings.ONESIGNAL_APP_ID or '').strip() and not settings.ONESIGNAL_APP_ID.startswith('mock'))
    onesignal_rest_key_set = bool((settings.ONESIGNAL_REST_API_KEY or '').strip() and not settings.ONESIGNAL_REST_API_KEY.startswith('mock'))

    liquidity_dry_run = bool(settings.LIQUIDITY_DRY_RUN or not settings.LIQUIDITY_TREASURY_SEED)
    admin_protection_enabled = bool((settings.ADMIN_API_KEY or '').strip())

    # Static frontend pages — backend just reports they exist (frontend builds them).
    terms_url_exists = True
    privacy_url_exists = True

    # Last cycle health
    cycle_q = await db.execute(
        select(LiquidityExecution).order_by(LiquidityExecution.created_at.desc()).limit(1)
    )
    last_cycle = cycle_q.scalar_one_or_none()

    # Devices count (informational)
    dev_count = (await db.execute(select(func.count(OneSignalDevice.id)))).scalar() or 0

    ready_for_public_launch = bool(
        xaman_live
        and webhook_configured
        and onesignal_live
        and admin_protection_enabled
        and terms_url_exists
        and privacy_url_exists
        # liquidity_dry_run is intentional and does NOT block readiness;
        # it just prevents on-chain support transactions until the operator flips it.
    )

    blockers = []
    if not xaman_live:
        blockers.append('xaman_live: set XAMAN_MOCK_MODE=false and provide real keys')
    if not webhook_configured:
        blockers.append('webhook_configured: set webhook URL in xumm.dev OR XAMAN_WEBHOOK_REGISTERED=true')
    if not onesignal_live:
        if not onesignal_app_id_set:
            blockers.append('onesignal_live: ONESIGNAL_APP_ID missing')
        if not onesignal_rest_key_set:
            blockers.append('onesignal_live: ONESIGNAL_REST_KEY missing')
        if settings.ONESIGNAL_MOCK_MODE:
            blockers.append('onesignal_live: ONESIGNAL_MOCK_MODE is true')
    if not admin_protection_enabled:
        blockers.append('admin_protection_enabled: set ADMIN_API_KEY env var')

    return {
        'xaman_live': xaman_live,
        'webhook_configured': webhook_configured,
        'webhook_observed_count': real_webhooks,
        'onesignal_live': onesignal_live,
        'onesignal_app_id_set': onesignal_app_id_set,
        'onesignal_rest_key_set': onesignal_rest_key_set,
        'onesignal_subscribed_devices': int(dev_count),
        'liquidity_dry_run': liquidity_dry_run,
        'admin_protection_enabled': admin_protection_enabled,
        'terms_url_exists': terms_url_exists,
        'privacy_url_exists': privacy_url_exists,
        'ready_for_public_launch': ready_for_public_launch,
        'blockers': blockers,
        'last_liquidity_cycle': {
            'status': last_cycle.status if last_cycle else None,
            'completed_at': last_cycle.completed_at.isoformat() if last_cycle and last_cycle.completed_at else None,
            'allocated_xema_xrp': float(last_cycle.allocated_xema_xrp) if last_cycle else None,
        } if last_cycle else None,
        'community_wallet': settings.SUBSCRIPTION_DEST_ADDRESS,
        'webhook_url_hint': 'https://xrpl-money-machine.onrender.com/api/auth/xaman/webhook',
        'time': datetime.now(timezone.utc).isoformat(),
    }


@router.get('/version')
async def version():
    return {
        'service': 'XRPL Universal Money Machine',
        'version': '1.2.0',
        'time': datetime.now(timezone.utc).isoformat(),
    }
