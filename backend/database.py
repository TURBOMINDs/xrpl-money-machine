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
        # Lightweight migrations for new columns added after initial deploy.
        # SQLAlchemy create_all does NOT alter existing tables; we add missing
        # columns manually here so re-deploys work without manual SQL.
        try:
            await _ensure_columns(conn)
        except Exception as ex:
            import logging
            logging.getLogger('db').warning(f'column migration warning: {ex}')


async def _ensure_columns(conn):
    """Add new columns if missing (idempotent, dialect-agnostic)."""
    from sqlalchemy import text

    def _column_exists_sqlite(c, table, column):
        rows = c.exec_driver_sql(f"PRAGMA table_info('{table}')").fetchall()
        return any(r[1] == column for r in rows)

    def _column_exists_pg(c, table, column):
        rows = c.exec_driver_sql(
            "SELECT column_name FROM information_schema.columns "
            f"WHERE table_name = '{table}'"
        ).fetchall()
        return any(r[0] == column for r in rows)

    is_sqlite = settings.DATABASE_URL.startswith('sqlite')
    column_exists = _column_exists_sqlite if is_sqlite else _column_exists_pg

    additions = {
        'xaman_sessions': [
            ('tx_hash', 'VARCHAR'),
            ('delivered_amount_drops', 'VARCHAR'),
            ('dispatched_nodetype', 'VARCHAR'),
            ('raw_response_json', 'TEXT'),
            ('custom_meta_json', 'TEXT'),
            ('webhook_event_id', 'VARCHAR'),
        ],
    }

    def _add(c):
        for table, cols in additions.items():
            for col, coltype in cols:
                if not column_exists(c, table, col):
                    c.exec_driver_sql(f'ALTER TABLE {table} ADD COLUMN {col} {coltype}')

    await conn.run_sync(lambda sync_conn: _add(sync_conn))
