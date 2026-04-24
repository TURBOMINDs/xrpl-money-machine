"""Pydantic request/response schemas."""
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    xrpl_address: str
    display_name: Optional[str] = None
    created_at: datetime


class SubscriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tier: str
    status: str
    trial_ends_at: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    xrp_amount: Optional[float] = None
    tx_hash: Optional[str] = None


class TierInfo(BaseModel):
    id: str  # basic | plus | ultimate
    name: str
    usd_price: float
    xrp_price: float
    amm_slots: int
    swaps_per_24h: int
    features: List[str]
    badge: Optional[str] = None


class MeOut(BaseModel):
    user: UserOut
    subscription: Optional[SubscriptionOut] = None
    slots_used: int
    slots_limit: int


class XamanSignInResponse(BaseModel):
    payload_uuid: str
    qr_url: str
    deeplink: str
    status: str


class XamanStatusResponse(BaseModel):
    payload_uuid: str
    status: str
    signed: bool
    address: Optional[str] = None
    token: Optional[str] = None
    user: Optional[UserOut] = None


class XamanMockResolveRequest(BaseModel):
    payload_uuid: str
    address: str


class SubscribeRequest(BaseModel):
    tier: Literal['basic', 'plus', 'ultimate']


class SubscribeResponse(BaseModel):
    intent_id: str
    payload_uuid: str
    qr_url: str
    deeplink: str
    xrp_amount: float
    usd_amount: float
    status: str
    dest_address: str


class StartTrialResponse(BaseModel):
    subscription: SubscriptionOut
    message: str


class CreateAmmPairRequest(BaseModel):
    lp_address: str = Field(..., min_length=20, max_length=64)
    pair_name: Optional[str] = None


class AmmPairOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    lp_address: str
    pair_name: Optional[str] = None
    asset1_code: Optional[str] = None
    asset2_code: Optional[str] = None
    trading_fee_bps: Optional[int] = None
    lp_token_supply: Optional[float] = None
    reserve_asset1: Optional[float] = None
    reserve_asset2: Optional[float] = None
    status: str
    last_polled_at: Optional[datetime] = None
    created_at: datetime


class CreateAlertRequest(BaseModel):
    amm_pair_id: Optional[str] = None
    type: Literal['price_above', 'price_below', 'pct_change', 'whale_buy', 'whale_sell', 'liquidity_surge']
    threshold: Optional[float] = None
    currency: str = 'USD'


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    amm_pair_id: Optional[str] = None
    type: str
    threshold: Optional[float] = None
    currency: str
    is_active: bool
    triggered_count: int
    last_triggered_at: Optional[datetime] = None
    created_at: datetime


class AlertEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    amm_pair_id: Optional[str] = None
    type: str
    severity: str
    title: str
    message: Optional[str] = None
    tx_hash: Optional[str] = None
    created_at: datetime


class RankConfigIn(BaseModel):
    rank: Literal['shrimp', 'crab', 'octopus', 'dolphin', 'orca', 'shark', 'whale', 'humpback']
    price_alerts: bool = False
    activity_alerts: bool = True


class RankConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    rank: str
    price_alerts: bool
    activity_alerts: bool


class OneSignalSubscribeRequest(BaseModel):
    player_id: str


class SendTestPushRequest(BaseModel):
    heading: str = 'XRPL Alert'
    content: str = 'This is a test notification from XRPL Universal Money Machine.'


class ChartPoint(BaseModel):
    t: int  # unix timestamp (ms)
    o: float
    h: float
    l: float
    c: float
    v: float


class PairStatsOut(BaseModel):
    pair_id: str
    lp_address: str
    price_usd: Optional[float] = None
    price_xrp: Optional[float] = None
    reserve_asset1: Optional[float] = None
    reserve_asset2: Optional[float] = None
    trading_fee_bps: Optional[int] = None
    lp_token_supply: Optional[float] = None
    volume_24h_xrp: Optional[float] = None
    change_pct_24h: Optional[float] = None
