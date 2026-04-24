"""Subscription + trial + payment routes."""
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from auth import current_user
from config import settings
from database import get_db
from models import PaymentIntent, Subscription, User
from schemas import (
    MeOut, StartTrialResponse, SubscribeRequest, SubscribeResponse,
    SubscriptionOut, TierInfo, UserOut,
)
from services.plans import TIER_DEFS, get_tier, slots_for
from services.price_service import usd_to_xrp, get_xrp_usd
from services.xaman_service import xaman_service
from services.xrpl_service import xrpl_service

router = APIRouter(tags=['subscription'])


async def _get_active_sub(db: AsyncSession, user_id: str) -> Optional[Subscription]:
    res = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id).order_by(desc(Subscription.created_at))
    )
    return res.scalars().first()


@router.get('/subscriptions/plans', response_model=List[TierInfo])
async def list_plans():
    xrp_usd = await get_xrp_usd()
    tiers = []
    for t in TIER_DEFS.values():
        xrp_price = (t['usd_price'] / xrp_usd) if xrp_usd > 0 else 0.0
        tiers.append(TierInfo(
            id=t['id'], name=t['name'], usd_price=t['usd_price'], xrp_price=round(xrp_price, 2),
            amm_slots=t['amm_slots'], swaps_per_24h=t['swaps_per_24h'],
            features=t['features'], badge=t.get('badge'),
        ))
    return tiers


@router.get('/me', response_model=MeOut)
async def me(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    sub = await _get_active_sub(db, user.id)
    # count slots used
    from models import AmmPair
    res = await db.execute(select(AmmPair).where(AmmPair.user_id == user.id))
    used = len(res.scalars().all())
    tier_id = sub.tier if sub and sub.status in ('trial', 'active') else None
    return MeOut(
        user=UserOut.model_validate(user),
        subscription=SubscriptionOut.model_validate(sub) if sub else None,
        slots_used=used,
        slots_limit=slots_for(tier_id),
    )


@router.post('/subscriptions/start-trial', response_model=StartTrialResponse)
async def start_trial(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    existing = await _get_active_sub(db, user.id)
    if existing and existing.status in ('trial', 'active'):
        raise HTTPException(400, detail=f'subscription already {existing.status}')
    now = datetime.now(timezone.utc)
    sub = Subscription(
        user_id=user.id,
        tier='basic',
        status='trial',
        trial_ends_at=now + timedelta(days=3),
        current_period_start=now,
        current_period_end=now + timedelta(days=3),
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return StartTrialResponse(
        subscription=SubscriptionOut.model_validate(sub),
        message='3-day free trial started on Basic plan.',
    )


@router.post('/subscriptions/subscribe', response_model=SubscribeResponse)
async def subscribe(
    body: SubscribeRequest,
    request: Request,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    tier = get_tier(body.tier)
    if not tier:
        raise HTTPException(400, detail='invalid tier')
    usd = tier['usd_price']
    xrp = await usd_to_xrp(usd)
    xrp = round(xrp, 2)
    return_url = f"{str(request.base_url).rstrip('/')}/subscribe/return"
    # create Xaman payment payload
    memo = f'umm-sub-{user.id[:8]}-{body.tier}'
    payload = await xaman_service.create_payment_payload(
        destination=settings.SUBSCRIPTION_DEST_ADDRESS,
        amount_xrp=xrp,
        return_url=return_url,
        memo=memo,
    )
    intent = PaymentIntent(
        user_id=user.id,
        tier=body.tier,
        xaman_payload_uuid=payload['payload_uuid'],
        status='pending',
        xrp_amount=xrp,
        usd_amount=usd,
        qr_url=payload['qr_url'],
        deeplink=payload['deeplink'],
    )
    db.add(intent)
    await db.commit()
    await db.refresh(intent)
    return SubscribeResponse(
        intent_id=intent.id,
        payload_uuid=payload['payload_uuid'],
        qr_url=payload['qr_url'],
        deeplink=payload['deeplink'],
        xrp_amount=xrp,
        usd_amount=usd,
        status='pending',
        dest_address=settings.SUBSCRIPTION_DEST_ADDRESS,
    )


@router.get('/subscriptions/intent/{intent_id}')
async def get_intent(intent_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(PaymentIntent).where(PaymentIntent.id == intent_id, PaymentIntent.user_id == user.id))
    intent = res.scalar_one_or_none()
    if not intent:
        raise HTTPException(404, detail='intent not found')
    # poll xaman status
    st = await xaman_service.get_payload_status(intent.xaman_payload_uuid)
    if st.get('signed') and intent.status == 'pending':
        # In mock mode: trust the mock and activate. In real mode: verify on ledger.
        ok = True
        if not settings.XAMAN_MOCK_MODE and st.get('tx_hash'):
            verify = await xrpl_service.verify_payment(
                tx_hash=st['tx_hash'],
                expected_dest=settings.SUBSCRIPTION_DEST_ADDRESS,
                min_xrp=intent.xrp_amount * 0.98,
            )
            ok = verify.get('ok', False)
        if ok:
            intent.status = 'signed'
            intent.tx_hash = st.get('tx_hash')
            # activate subscription
            now = datetime.now(timezone.utc)
            sub = Subscription(
                user_id=user.id,
                tier=intent.tier,
                status='active',
                current_period_start=now,
                current_period_end=now + timedelta(days=30),
                xrp_amount=intent.xrp_amount,
                tx_hash=intent.tx_hash,
            )
            db.add(sub)
            await db.commit()
    return {
        'intent_id': intent.id,
        'status': intent.status,
        'tier': intent.tier,
        'xrp_amount': intent.xrp_amount,
        'usd_amount': intent.usd_amount,
        'tx_hash': intent.tx_hash,
        'xaman_status': st,
    }


@router.post('/subscriptions/mock-resolve/{intent_id}')
async def mock_resolve_payment(intent_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    """Mock-mode only: simulate the user signing the payment in Xaman."""
    if not settings.XAMAN_MOCK_MODE:
        raise HTTPException(400, detail='only available in mock mode')
    res = await db.execute(select(PaymentIntent).where(PaymentIntent.id == intent_id, PaymentIntent.user_id == user.id))
    intent = res.scalar_one_or_none()
    if not intent:
        raise HTTPException(404, detail='intent not found')
    try:
        xaman_service.resolve_mock(intent.xaman_payload_uuid, address=user.xrpl_address)
    except KeyError:
        raise HTTPException(404, detail='payload not found')
    return await get_intent(intent_id, user, db)
