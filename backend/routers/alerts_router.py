"""Alerts + events routes."""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from auth import current_user, optional_current_user
from database import get_db
from models import Alert, AlertEvent, User
from schemas import AlertEventOut, AlertOut, CreateAlertRequest
from services.admin_auth import require_admin
from services.onesignal_service import onesignal_service

router = APIRouter(tags=['alerts'])


@router.get('/alerts', response_model=List[AlertOut])
async def list_alerts(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(Alert).where(Alert.user_id == user.id).order_by(desc(Alert.created_at))
    )
    return [AlertOut.model_validate(a) for a in res.scalars().all()]


@router.post('/alerts', response_model=AlertOut)
async def create_alert(
    body: CreateAlertRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    alert = Alert(
        user_id=user.id,
        amm_pair_id=body.amm_pair_id,
        type=body.type,
        threshold=body.threshold,
        currency=body.currency or 'USD',
        is_active=True,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return AlertOut.model_validate(alert)


@router.patch('/alerts/{alert_id}/toggle', response_model=AlertOut)
async def toggle_alert(
    alert_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Alert).where(Alert.id == alert_id, Alert.user_id == user.id))
    a = res.scalar_one_or_none()
    if not a:
        raise HTTPException(404, detail='not found')
    a.is_active = not a.is_active
    await db.commit()
    await db.refresh(a)
    return AlertOut.model_validate(a)


@router.delete('/alerts/{alert_id}')
async def delete_alert(
    alert_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Alert).where(Alert.id == alert_id, Alert.user_id == user.id))
    a = res.scalar_one_or_none()
    if not a:
        raise HTTPException(404, detail='not found')
    await db.delete(a)
    await db.commit()
    return {'ok': True}


@router.get('/alerts/events', response_model=List[AlertEventOut])
async def list_events(
    limit: int = Query(30, ge=1, le=200),
    pair_id: Optional[str] = None,
    user: Optional[User] = Depends(optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(AlertEvent)
    if user:
        q = q.where((AlertEvent.user_id == user.id) | (AlertEvent.user_id.is_(None)))
    else:
        # public demo feed: show only public events (user_id NULL)
        q = q.where(AlertEvent.user_id.is_(None))
    if pair_id:
        q = q.where(AlertEvent.amm_pair_id == pair_id)
    q = q.order_by(desc(AlertEvent.created_at)).limit(limit)
    res = await db.execute(q)
    return [AlertEventOut.model_validate(e) for e in res.scalars().all()]


@router.post('/alerts/test-notification', dependencies=[Depends(require_admin)])
async def test_broadcast_notification(
    heading: str = 'XRPL UMM Test Alert',
    content: str = 'This is a test broadcast notification from XRPL Universal Money Machine.',
):
    """Send a test push notification to ALL subscribed users.

    Admin-protected. Useful to verify OneSignal integration end-to-end before
    relying on real whale/price/liquidity events to trigger pushes.
    """
    res = await onesignal_service.broadcast(
        heading=heading,
        content=content,
        data={'test': True, 'kind': 'broadcast_test'},
    )
    return {
        'ok': True,
        'mode': onesignal_service.mode,
        'app_id': onesignal_service.app_id,
        'result': res,
    }

