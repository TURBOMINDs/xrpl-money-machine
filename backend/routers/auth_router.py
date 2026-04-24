"""Xaman auth routes (mock + real)."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import create_token, current_user
from database import get_db
from models import User, XamanSession
from schemas import XamanMockResolveRequest, XamanSignInResponse, XamanStatusResponse, UserOut
from services.xaman_service import xaman_service

router = APIRouter(prefix='/auth/xaman', tags=['auth'])


@router.post('/signin', response_model=XamanSignInResponse)
async def xaman_signin(request: Request, db: AsyncSession = Depends(get_db)):
    return_url = f"{str(request.base_url).rstrip('/')}/auth/xaman/return"
    p = await xaman_service.create_signin_payload(return_url)
    # persist session
    sess = XamanSession(
        payload_uuid=p['payload_uuid'],
        purpose='signin',
        status='pending',
    )
    db.add(sess)
    await db.commit()
    return p


@router.get('/status/{payload_uuid}', response_model=XamanStatusResponse)
async def xaman_status(payload_uuid: str, db: AsyncSession = Depends(get_db)):
    st = await xaman_service.get_payload_status(payload_uuid)
    # persist latest state + upsert user if signed
    result = await db.execute(select(XamanSession).where(XamanSession.payload_uuid == payload_uuid))
    sess = result.scalar_one_or_none()
    user_out = None
    token_str = None
    if st.get('signed') and st.get('address'):
        # upsert user
        res = await db.execute(select(User).where(User.xrpl_address == st['address']))
        u = res.scalar_one_or_none()
        if not u:
            u = User(xrpl_address=st['address'])
            db.add(u)
            await db.flush()
        else:
            u.last_login_at = datetime.now(timezone.utc)
        token_str = create_token(u.id)
        user_out = UserOut.model_validate(u)
        if sess:
            sess.status = 'signed'
            sess.address = st['address']
            sess.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    resp = XamanStatusResponse(
        payload_uuid=payload_uuid,
        status=st.get('status', 'pending'),
        signed=bool(st.get('signed')),
        address=st.get('address'),
        token=token_str,
        user=user_out,
    )
    response = JSONResponse(resp.model_dump(mode='json'))
    if token_str:
        response.set_cookie('umm_token', token_str, max_age=60 * 60 * 24 * 7, httponly=True, samesite='lax')
    return response


@router.post('/mock-resolve', response_model=XamanStatusResponse)
async def xaman_mock_resolve(body: XamanMockResolveRequest, db: AsyncSession = Depends(get_db)):
    try:
        xaman_service.resolve_mock(body.payload_uuid, body.address)
    except KeyError:
        raise HTTPException(status_code=404, detail='payload not found')
    return await xaman_status(body.payload_uuid, db)


@router.post('/logout')
async def logout():
    resp = JSONResponse({'ok': True})
    resp.delete_cookie('umm_token')
    return resp


@router.get('/me', response_model=UserOut)
async def me(user: User = Depends(current_user)):
    return UserOut.model_validate(user)
