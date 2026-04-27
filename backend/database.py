"""Async SQLAlchemy engine + session."""
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from config import settings

Base = declarative_base()

# SQLite doesn't support pool_size/max_overflow; PostgreSQL does.
_engine_kwargs = {'echo': False, 'pool_pre_ping': True}
if not settings.DATABASE_URL.startswith('sqlite'):
    _engine_kwargs.update({'pool_size': 10, 'max_overflow': 20})

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db():
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


@asynccontextmanager
async def db_context():
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    # Import models so metadata is registered
    from models import (  # noqa: F401
        User, Subscription, PaymentIntent, AmmPair, Alert, AlertEvent,
        HolderRankConfig, XamanSession, OneSignalDevice,
        SupportAction, LiquidityExecution, PriceSnapshot, PairTransaction,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
