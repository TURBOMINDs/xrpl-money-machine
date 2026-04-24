"""Notification (OneSignal) routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import current_user
from config import settings
from database import get_db
from models import OneSignalDevice, User
from schemas import OneSignalSubscribeRequest, SendTestPushRequest
from services.onesignal_service import onesignal_service

router = APIRouter(prefix='/notifications', tags=['notifications'])


@router.post('/onesignal/subscribe')
async def subscribe_device(
    body: OneSignalSubscribeRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(OneSignalDevice).where(
            OneSignalDevice.user_id == user.id, OneSignalDevice.player_id == body.player_id,
        )
    )
    if res.scalar_one_or_none():
        return {'ok': True, 'already_subscribed': True}
    dev = OneSignalDevice(user_id=user.id, player_id=body.player_id)
    db.add(dev)
    await db.commit()
    return {'ok': True}


@router.get('/onesignal/config')
async def onesignal_config():
    return {
        'app_id': settings.ONESIGNAL_APP_ID,
        'mock_mode': settings.ONESIGNAL_MOCK_MODE,
    }


@router.post('/test')
async def send_test(
    body: SendTestPushRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(OneSignalDevice.player_id).where(OneSignalDevice.user_id == user.id))
    players = [r[0] for r in res.all()]
    if not players:
        # still mock-log, but also return feedback so UI knows to enable OneSignal
        await onesignal_service.send_to_players(
            player_ids=[f'mock-player-{user.id[:8]}'],
            heading=body.heading, content=body.content, data={'test': True},
        )
        return {'ok': True, 'sent': 1, 'mock': True, 'message': 'No OneSignal device subscribed, sent mock push.'}
    r = await onesignal_service.send_to_players(
        player_ids=players, heading=body.heading, content=body.content, data={'test': True},
    )
    return {'ok': True, 'sent': len(players), 'result': r}


@router.get('/log')
async def mock_log():
    return {'mock': True, 'events': onesignal_service.mock_log()}
