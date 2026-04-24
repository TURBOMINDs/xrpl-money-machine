"""XRPL Universal Money Machine - FastAPI server entrypoint."""
import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from config import settings
from database import SessionLocal, init_db
from models import AlertEvent
from routers.alerts_router import router as alerts_router
from routers.amm_router import router as amm_router
from routers.auth_router import router as auth_router
from routers.notifications_router import router as notifications_router
from routers.ranks_router import router as ranks_router
from routers.subscription_router import router as subscription_router
from services.price_service import get_xrp_usd
from services.worker import worker_loop

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(name)s | %(levelname)s | %(message)s',
)
log = logging.getLogger('server')


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info('Starting XRPL Universal Money Machine backend…')
    await init_db()
    log.info('Database tables ensured.')
    # seed public demo alert events if empty so landing-page feed has content
    async with SessionLocal() as db:
        res = await db.execute(select(AlertEvent).where(AlertEvent.user_id.is_(None)).limit(1))
        if not res.scalar_one_or_none():
            import uuid
            samples = [
                ('humpback_buy', 'critical', 'Humpback Buy Alert', '100K+ XRP purchased!'),
                ('liquidity_surge', 'warning', 'Liquidity Surge Alert', 'AMM pool up 15%'),
                ('shark_sell', 'critical', 'Shark Sell Pressure',
                 'Large sell action detected — possible reversal zone'),
                ('shark_buy', 'warning', 'Shark Buy Alert', '35,000 XRP buy detected'),
                ('liquidity_surge', 'warning', 'Liquidity Surge Alert', 'AMM pool up 9%'),
            ]
            for i, (t, sev, title, msg) in enumerate(samples):
                db.add(AlertEvent(
                    id=str(uuid.uuid4()),
                    user_id=None,
                    amm_pair_id=None,
                    type=t,
                    severity=sev,
                    title=title,
                    message=msg,
                    tx_hash=f'MOCK{uuid.uuid4().hex[:28].upper()}',
                    created_at=datetime.now(timezone.utc),
                ))
            await db.commit()
            log.info('Seeded public demo alert events.')
    # start background worker
    task = asyncio.create_task(worker_loop(interval_seconds=30))
    yield
    log.info('Shutting down…')
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title='XRPL Universal Money Machine', version='1.0.0', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[o for o in settings.CORS_ORIGINS.split(',') if o] or ['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

api = APIRouter(prefix='/api')


@api.get('/')
async def root():
    return {
        'service': 'XRPL Universal Money Machine',
        'version': '1.0.0',
        'xaman_mock_mode': settings.XAMAN_MOCK_MODE,
        'onesignal_mock_mode': settings.ONESIGNAL_MOCK_MODE,
    }


@api.get('/health')
async def health():
    try:
        xrp_usd = await get_xrp_usd()
    except Exception:
        xrp_usd = None
    return {
        'ok': True,
        'time': datetime.now(timezone.utc).isoformat(),
        'xrp_usd': xrp_usd,
    }


# mount feature routers under /api
api.include_router(auth_router)
api.include_router(subscription_router)
api.include_router(amm_router)
api.include_router(alerts_router)
api.include_router(ranks_router)
api.include_router(notifications_router)

app.include_router(api)
