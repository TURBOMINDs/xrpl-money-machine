"""SQLAlchemy models for XRPL Universal Money Machine."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text,
)
from sqlalchemy.orm import relationship

from database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = 'users'
    id = Column(String, primary_key=True, default=_uuid)
    xrpl_address = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)
    last_login_at = Column(DateTime(timezone=True), default=_now)

    subscriptions = relationship('Subscription', back_populates='user', cascade='all, delete-orphan')
    amm_pairs = relationship('AmmPair', back_populates='user', cascade='all, delete-orphan')
    alerts = relationship('Alert', back_populates='user', cascade='all, delete-orphan')
    ranks = relationship('HolderRankConfig', back_populates='user', cascade='all, delete-orphan')
    devices = relationship('OneSignalDevice', back_populates='user', cascade='all, delete-orphan')


class Subscription(Base):
    __tablename__ = 'subscriptions'
    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    tier = Column(String, nullable=False)  # basic | plus | ultimate
    status = Column(String, nullable=False, default='trial')  # trial | active | expired | cancelled
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    current_period_start = Column(DateTime(timezone=True), default=_now)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    xrp_amount = Column(Float, nullable=True)
    tx_hash = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    user = relationship('User', back_populates='subscriptions')


class PaymentIntent(Base):
    __tablename__ = 'payment_intents'
    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    tier = Column(String, nullable=False)
    xaman_payload_uuid = Column(String, nullable=True, index=True)
    status = Column(String, nullable=False, default='pending')  # pending | signed | rejected | expired
    xrp_amount = Column(Float, nullable=False)
    usd_amount = Column(Float, nullable=False)
    tx_hash = Column(String, nullable=True)
    qr_url = Column(String, nullable=True)
    deeplink = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)


class AmmPair(Base):
    __tablename__ = 'amm_pairs'
    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    lp_address = Column(String, nullable=False)
    pair_name = Column(String, nullable=True)
    asset1_code = Column(String, nullable=True)
    asset1_issuer = Column(String, nullable=True)
    asset2_code = Column(String, nullable=True)
    asset2_issuer = Column(String, nullable=True)
    trading_fee_bps = Column(Integer, nullable=True)
    lp_token_supply = Column(Float, nullable=True)
    reserve_asset1 = Column(Float, nullable=True)
    reserve_asset2 = Column(Float, nullable=True)
    status = Column(String, nullable=False, default='active')  # active | paused
    last_polled_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)

    user = relationship('User', back_populates='amm_pairs')
    alerts = relationship('Alert', back_populates='amm_pair', cascade='all, delete-orphan')
    events = relationship('AlertEvent', back_populates='amm_pair', cascade='all, delete-orphan')


class Alert(Base):
    __tablename__ = 'alerts'
    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    amm_pair_id = Column(String, ForeignKey('amm_pairs.id', ondelete='SET NULL'), nullable=True)
    type = Column(String, nullable=False)  # price_above | price_below | pct_change | whale_buy | whale_sell | liquidity_surge
    threshold = Column(Float, nullable=True)
    currency = Column(String, default='USD')
    is_active = Column(Boolean, default=True)
    triggered_count = Column(Integer, default=0)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)

    user = relationship('User', back_populates='alerts')
    amm_pair = relationship('AmmPair', back_populates='alerts')


class AlertEvent(Base):
    __tablename__ = 'alert_events'
    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=True, index=True)
    amm_pair_id = Column(String, ForeignKey('amm_pairs.id', ondelete='SET NULL'), nullable=True)
    alert_id = Column(String, ForeignKey('alerts.id', ondelete='SET NULL'), nullable=True)
    type = Column(String, nullable=False)  # humpback_buy | liquidity_surge | shark_sell | price_above | etc.
    severity = Column(String, default='info')  # info | warning | critical
    title = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    tx_hash = Column(String, nullable=True)
    payload_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, index=True)

    amm_pair = relationship('AmmPair', back_populates='events')


class HolderRankConfig(Base):
    __tablename__ = 'holder_rank_configs'
    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    rank = Column(String, nullable=False)  # shrimp | crab | octopus | dolphin | orca | shark | whale | humpback
    price_alerts = Column(Boolean, default=False)
    activity_alerts = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    user = relationship('User', back_populates='ranks')


class XamanSession(Base):
    __tablename__ = 'xaman_sessions'
    id = Column(String, primary_key=True, default=_uuid)
    payload_uuid = Column(String, unique=True, nullable=False, index=True)
    purpose = Column(String, nullable=False)  # signin | payment
    status = Column(String, default='pending')  # pending | signed | rejected | expired
    address = Column(String, nullable=True)
    user_token = Column(String, nullable=True)
    meta_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class OneSignalDevice(Base):
    __tablename__ = 'onesignal_devices'
    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    player_id = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now)

    user = relationship('User', back_populates='devices')
