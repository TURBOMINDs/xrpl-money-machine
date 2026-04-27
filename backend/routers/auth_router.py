"""Xaman auth + webhook routes.

Real-mode flow (XAMAN_MOCK_MODE=false):
  1) POST /api/auth/xaman/signin           — creates a real Xaman SignIn payload
  2) Frontend renders the QR / deeplink    — user signs in their Xaman wallet
  3) Xaman calls POST /api/auth/xaman/webhook with HMAC-SHA256 signature
  4) Webhook verifies signature, idempotently updates xaman_sessions, upserts user
  5) Frontend polls GET /api/auth/xaman/status/{uuid} → receives token + user

Dev backdoor (works in BOTH modes):
  POST /api/auth/xaman/mock-resolve {payload_uuid?, address}
  Creates a User record + JWT directly without touching Xaman. Useful for
  automated tests and local dev without a wallet on hand.
"""
import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import create_token, current_user
from config import settings
from database import get_db
from models import PaymentIntent, Subscription, User, XamanSession
from schemas import (
    UserOut, XamanMockResolveRequest, XamanSignInResponse, XamanStatusResponse,
)
from services.xaman_service import xaman_service

router = APIRouter(prefix='/auth/xaman', tags=['auth'])
log = logging.getLogger('xaman_router')


# ──────────────────────────────────────────────────────────────────────────────
# Sign-in (real or mock)
# ──────────────────────────────────────────────────────────────────────────────
@router.post('/signin', response_model=XamanSignInResponse)
async def xaman_signin(request: Request, db: AsyncSession = Depends(get_db)):
    return_url = f"{str(request.base_url).rstrip('/')}/auth/xaman/return"
    p = await xaman_service.create_signin_payload(return_url)
    sess = XamanSession(
        payload_uuid=p['payload_uuid'],
        purpose='signin',
        status='pending',
    )
    db.add(sess)
    await db.commit()
    return p


# ──────────────────────────────────────────────────────────────────────────────
# Status polling (server-side fallback to webhook)
# ──────────────────────────────────────────────────────────────────────────────
@router.get('/status/{payload_uuid}', response_model=XamanStatusResponse)
async def xaman_status(payload_uuid: str, db: AsyncSession = Depends(get_db)):
    # Local DB is the source of truth (updated by webhook OR by mock-resolve).
    res = await db.execute(select(XamanSession).where(XamanSession.payload_uuid == payload_uuid))
    sess = res.scalar_one_or_none()

    # Prefer authoritative API state when not mock — refreshes our DB if webhook hasn't fired
    if not settings.XAMAN_MOCK_MODE and sess and sess.status == 'pending':
        try:
            api_state = await xaman_service.get_payload_status(payload_uuid)
            if api_state.get('signed') and api_state.get('address'):
                sess.status = 'signed'
                sess.address = api_state['address']
                sess.tx_hash = api_state.get('tx_hash')
                sess.resolved_at = datetime.now(timezone.utc)
                sess.raw_response_json = json.dumps(api_state.get('raw') or {})[:8000]
        except Exception as e:
            log.debug(f'real-mode status poll failed: {e}')

    if sess and sess.status == 'pending' and settings.XAMAN_MOCK_MODE:
        # in mock mode we read from the in-memory store directly
        api_state = await xaman_service.get_payload_status(payload_uuid)
        if api_state.get('signed') and api_state.get('address'):
            sess.status = 'signed'
            sess.address = api_state['address']
            sess.tx_hash = api_state.get('tx_hash')
            sess.resolved_at = datetime.now(timezone.utc)

    user_out = None
    token_str = None
    if sess and sess.status == 'signed' and sess.address and sess.purpose == 'signin':
        # upsert user
        ures = await db.execute(select(User).where(User.xrpl_address == sess.address))
        u = ures.scalar_one_or_none()
        if not u:
            u = User(xrpl_address=sess.address)
            db.add(u)
            await db.flush()
        else:
            u.last_login_at = datetime.now(timezone.utc)
        token_str = create_token(u.id)
        user_out = UserOut.model_validate(u)

    await db.commit()

    resp = XamanStatusResponse(
        payload_uuid=payload_uuid,
        status=(sess.status if sess else 'unknown'),
        signed=bool(sess and sess.status == 'signed'),
        address=(sess.address if sess else None),
        token=token_str,
        user=user_out,
    )
    response = JSONResponse(resp.model_dump(mode='json'))
    if token_str:
        response.set_cookie('umm_token', token_str, max_age=60 * 60 * 24 * 7, httponly=True, samesite='lax')
    return response


# ──────────────────────────────────────────────────────────────────────────────
# Mock resolve — DEV BACKDOOR (works in both modes)
# ──────────────────────────────────────────────────────────────────────────────
@router.post('/mock-resolve', response_model=XamanStatusResponse)
async def xaman_mock_resolve(
    body: XamanMockResolveRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create or fetch a User by XRPL address and issue a JWT.

    This bypasses Xaman entirely so automated tests and local dev work without
    a wallet on hand. Behaves identically in mock and real modes.
    """
    addr = body.address.strip()
    if not addr.startswith('r') or len(addr) < 25:
        raise HTTPException(400, detail='invalid XRPL address')
    if settings.XAMAN_MOCK_MODE:
        try:
            xaman_service.resolve_mock(body.payload_uuid, addr)
        except KeyError:
            # not fatal — we still create the user
            pass

    # Update or create XamanSession row
    res = await db.execute(select(XamanSession).where(XamanSession.payload_uuid == body.payload_uuid))
    sess = res.scalar_one_or_none()
    if not sess:
        sess = XamanSession(payload_uuid=body.payload_uuid, purpose='signin', status='signed')
        db.add(sess)
    sess.status = 'signed'
    sess.address = addr
    sess.resolved_at = datetime.now(timezone.utc)

    # Upsert user
    ures = await db.execute(select(User).where(User.xrpl_address == addr))
    u = ures.scalar_one_or_none()
    if not u:
        u = User(xrpl_address=addr)
        db.add(u)
        await db.flush()
    else:
        u.last_login_at = datetime.now(timezone.utc)
    token = create_token(u.id)
    await db.commit()
    resp = XamanStatusResponse(
        payload_uuid=body.payload_uuid,
        status='signed',
        signed=True,
        address=addr,
        token=token,
        user=UserOut.model_validate(u),
    )
    response = JSONResponse(resp.model_dump(mode='json'))
    response.set_cookie('umm_token', token, max_age=60 * 60 * 24 * 7, httponly=True, samesite='lax')
    return response


# ──────────────────────────────────────────────────────────────────────────────
# Webhook — handles real Xaman callbacks
# ──────────────────────────────────────────────────────────────────────────────
def _hmac_hex(key: str, msg: bytes, algo: str = 'sha256') -> str:
    digestmod = hashlib.sha256 if algo == 'sha256' else hashlib.sha1
    return hmac.new(key.encode('utf-8'), msg, digestmod).hexdigest()


def _verify_webhook_signature(secret: str, raw_body: bytes, headers) -> dict:
    """Try multiple known Xaman signature header conventions and HMAC algos.

    Returns {ok: bool, header: str, algo: str, expected: str, found: str}.
    """
    # Possible header names (Xaman docs vary by version).
    sig_headers = [
        'x-xumm-request-signature', 'x-xumm-signature', 'x-signature',
        'X-Xumm-Request-Signature', 'X-Xumm-Signature', 'X-Signature',
    ]
    ts_headers = ['x-timestamp', 'X-Timestamp', 'x-xumm-timestamp', 'X-Xumm-Timestamp']
    found_sig = None
    for h in sig_headers:
        if h in headers:
            found_sig = headers[h]
            break
    if not found_sig:
        return {'ok': False, 'reason': 'missing_signature_header'}

    timestamp = ''
    for h in ts_headers:
        if h in headers:
            timestamp = headers[h]
            break

    candidates = []
    # variant A: HMAC-SHA256(timestamp + body)
    candidates.append(('sha256', _hmac_hex(secret, (timestamp.encode() + raw_body), 'sha256')))
    # variant B: HMAC-SHA256(body)
    candidates.append(('sha256_body', _hmac_hex(secret, raw_body, 'sha256')))
    # variant C: HMAC-SHA1(body)
    candidates.append(('sha1_body', _hmac_hex(secret, raw_body, 'sha1')))
    # variant D: HMAC-SHA1(timestamp + body)
    candidates.append(('sha1', _hmac_hex(secret, (timestamp.encode() + raw_body), 'sha1')))

    for algo, expected in candidates:
        if hmac.compare_digest(expected, found_sig.lower()):
            return {'ok': True, 'algo': algo, 'expected': expected, 'found': found_sig}

    return {
        'ok': False,
        'reason': 'signature_mismatch',
        'tried_algos': [c[0] for c in candidates],
        'found': found_sig[:32] + '…',
    }


async def _process_webhook_payload(db: AsyncSession, body_json: dict, raw_body: bytes,
                                   verified: bool) -> dict:
    """Idempotent persistence + user upsert + subscription activation."""
    # Xaman webhook bodies use snake_case in modern docs, but be defensive
    payload_uuid = (
        body_json.get('payload_uuidv4')
        or body_json.get('payload_uuid')
        or (body_json.get('payloadResponse') or {}).get('payload_uuidv4')
        or body_json.get('uuid')
    )
    if not payload_uuid:
        raise HTTPException(400, detail='missing payload uuid in webhook body')

    payload_resp = body_json.get('payloadResponse') or body_json.get('payload_response') or {}
    custom_meta = body_json.get('customMeta') or body_json.get('custom_meta') or {}
    user_token_obj = body_json.get('userToken') or body_json.get('user_token') or {}

    txid = payload_resp.get('txid') or body_json.get('txid')
    account = payload_resp.get('account') or body_json.get('account')
    signed = bool(
        payload_resp.get('signed', body_json.get('signed', False))
        or (txid is not None and account is not None)
    )
    rejected = bool(body_json.get('rejected', False))
    dispatched_nodetype = (
        payload_resp.get('dispatched_nodetype')
        or body_json.get('dispatched_nodetype')
    )

    # Idempotency: webhook_event_id from body or compose
    webhook_event_id = body_json.get('reference_call_uuidv4') or f'{payload_uuid}:{txid or "no-tx"}'

    res = await db.execute(select(XamanSession).where(XamanSession.payload_uuid == payload_uuid))
    sess = res.scalar_one_or_none()
    if not sess:
        # Webhook arrived before we persisted the session locally — create a stub
        sess = XamanSession(
            payload_uuid=payload_uuid,
            purpose='signin',  # default; PaymentIntent lookup below corrects intent
        )
        db.add(sess)

    if sess.webhook_event_id == webhook_event_id and sess.status in ('signed', 'rejected'):
        log.info(f'webhook idempotent replay for {payload_uuid}')
        return {'status': 'already_processed', 'payload_uuid': payload_uuid}

    sess.webhook_event_id = webhook_event_id
    sess.tx_hash = txid
    sess.address = account
    sess.dispatched_nodetype = dispatched_nodetype
    sess.delivered_amount_drops = str(payload_resp.get('dispatched_to_node') or '') or None
    sess.raw_response_json = json.dumps(body_json)[:8000]
    sess.custom_meta_json = json.dumps(custom_meta)[:2000] if custom_meta else None
    sess.user_token = user_token_obj.get('user_token') if isinstance(user_token_obj, dict) else None
    sess.resolved_at = datetime.now(timezone.utc)

    if rejected:
        sess.status = 'rejected'
    elif signed:
        sess.status = 'signed'
    else:
        sess.status = 'expired'

    # If this is a payment payload, find its intent and activate the sub
    intent_res = await db.execute(
        select(PaymentIntent).where(PaymentIntent.xaman_payload_uuid == payload_uuid)
    )
    intent = intent_res.scalar_one_or_none()
    if intent:
        sess.purpose = 'payment'
        if signed and not rejected:
            intent.status = 'signed'
            intent.tx_hash = txid
            # Activate subscription
            from datetime import timedelta
            now = datetime.now(timezone.utc)
            new_sub = Subscription(
                user_id=intent.user_id,
                tier=intent.tier,
                status='active',
                current_period_start=now,
                current_period_end=now + timedelta(days=30),
                xrp_amount=intent.xrp_amount,
                tx_hash=txid,
            )
            db.add(new_sub)
        elif rejected:
            intent.status = 'rejected'

    # If sign-in, upsert user
    if sess.purpose == 'signin' and signed and account:
        ures = await db.execute(select(User).where(User.xrpl_address == account))
        u = ures.scalar_one_or_none()
        if not u:
            u = User(xrpl_address=account)
            db.add(u)
            await db.flush()
        else:
            u.last_login_at = datetime.now(timezone.utc)

    await db.commit()
    return {
        'status': 'processed',
        'payload_uuid': payload_uuid,
        'session_status': sess.status,
        'tx_hash': txid,
        'verified': verified,
    }


@router.post('/webhook')
async def xaman_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Receive real Xaman webhook callbacks. Verify HMAC, then idempotently persist."""
    raw_body = await request.body()
    try:
        body_json = json.loads(raw_body.decode('utf-8') or '{}')
    except json.JSONDecodeError:
        raise HTTPException(400, detail='invalid JSON body')

    verified = False
    if settings.XAMAN_WEBHOOK_VERIFY and not settings.XAMAN_MOCK_MODE:
        v = _verify_webhook_signature(
            settings.XAMAN_API_SECRET, raw_body,
            {k.lower(): v for k, v in request.headers.items()},
        )
        verified = v.get('ok', False)
        if not verified:
            log.warning(f'webhook signature verification FAILED: {v}')
            raise HTTPException(status_code=401, detail='invalid_signature')
        log.info(f'webhook signature verified via algo={v.get("algo")}')
    else:
        log.info('webhook signature verification disabled (mock mode or XAMAN_WEBHOOK_VERIFY=false)')

    return await _process_webhook_payload(db, body_json, raw_body, verified)


@router.post('/webhook/test')
async def xaman_webhook_self_test(
    payload_uuid: str,
    address: str = 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY',
    txid: Optional[str] = None,
    rejected: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Developer self-test: simulates a Xaman webhook delivery WITHOUT going through
    the real Xaman service. Bypasses signature check by setting verified=True.
    Useful to confirm DB persistence + subscription activation logic works.
    """
    body = {
        'payload_uuidv4': payload_uuid,
        'reference_call_uuidv4': f'self-test-{payload_uuid}',
        'signed': not rejected,
        'rejected': rejected,
        'payloadResponse': {
            'signed': not rejected,
            'rejected': rejected,
            'txid': txid or f'TESTTX{payload_uuid.replace("-", "").upper()[:24]}',
            'account': address,
            'dispatched_nodetype': 'MAINNET',
        },
        'customMeta': {'identifier': 'self-test'},
    }
    raw = json.dumps(body).encode()
    return await _process_webhook_payload(db, body, raw, verified=True)


@router.post('/logout')
async def logout():
    resp = JSONResponse({'ok': True})
    resp.delete_cookie('umm_token')
    return resp


@router.get('/me', response_model=UserOut)
async def me(user: User = Depends(current_user)):
    return UserOut.model_validate(user)


@router.get('/config')
async def xaman_config():
    """Public: surface mock/real mode + whether webhook verification is enabled."""
    return {
        'mock_mode': settings.XAMAN_MOCK_MODE,
        'webhook_verify_enabled': settings.XAMAN_WEBHOOK_VERIFY,
        'has_real_keys': bool(
            settings.XAMAN_API_KEY and not settings.XAMAN_API_KEY.startswith('mock')
        ),
    }
