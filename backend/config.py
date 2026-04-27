"""App settings loaded from env."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


class Settings:
    DATABASE_URL: str = os.environ.get(
        'DATABASE_URL',
        'sqlite+aiosqlite:////app/backend/db/app.db',
    )
    XRPL_RPC_URL: str = os.environ.get('XRPL_RPC_URL', 'https://s1.ripple.com:51234/')
    XRPL_WS_URL: str = os.environ.get('XRPL_WS_URL', 'wss://s1.ripple.com')
    XAMAN_API_KEY: str = os.environ.get('XAMAN_API_KEY', 'mock_key_placeholder')
    XAMAN_API_SECRET: str = os.environ.get('XAMAN_API_SECRET', 'mock_secret_placeholder')
    XAMAN_MOCK_MODE: bool = os.environ.get('XAMAN_MOCK_MODE', 'true').lower() in ('1', 'true', 'yes')
    XAMAN_WEBHOOK_VERIFY: bool = os.environ.get('XAMAN_WEBHOOK_VERIFY', 'true').lower() in ('1', 'true', 'yes')
    ONESIGNAL_APP_ID: str = os.environ.get('ONESIGNAL_APP_ID', 'mock_app_id_placeholder')
    ONESIGNAL_REST_API_KEY: str = os.environ.get('ONESIGNAL_REST_API_KEY', 'mock_rest_api_key_placeholder')
    ONESIGNAL_MOCK_MODE: bool = os.environ.get('ONESIGNAL_MOCK_MODE', 'true').lower() in ('1', 'true', 'yes')
    JWT_SECRET: str = os.environ.get('JWT_SECRET', 'dev-secret-change-me')
    JWT_ALGORITHM: str = os.environ.get('JWT_ALGORITHM', 'HS256')
    JWT_EXPIRE_HOURS: int = int(os.environ.get('JWT_EXPIRE_HOURS', '168'))
    SUBSCRIPTION_DEST_ADDRESS: str = os.environ.get(
        'SUBSCRIPTION_DEST_ADDRESS', 'rJkpUojYKYArCRkrdDhaSMZzTw77r1UiMC'
    )
    # XEMA Liquidity Execution Engine
    LIQUIDITY_DRY_RUN: bool = os.environ.get('LIQUIDITY_DRY_RUN', 'true').lower() in ('1', 'true', 'yes')
    LIQUIDITY_TREASURY_SEED: str = os.environ.get('LIQUIDITY_TREASURY_SEED', '')
    LIQUIDITY_TARGET_AMM_ADDRESS: str = os.environ.get('LIQUIDITY_TARGET_AMM_ADDRESS', '')
    ALLOCATION_XEMA_PCT: float = float(os.environ.get('ALLOCATION_XEMA_PCT', '65'))
    ALLOCATION_OPS_PCT: float = float(os.environ.get('ALLOCATION_OPS_PCT', '35'))
    # OHLC engine
    OHLC_SNAPSHOT_INTERVAL_SECONDS: int = int(os.environ.get('OHLC_SNAPSHOT_INTERVAL_SECONDS', '60'))
    OHLC_RETENTION_DAYS: int = int(os.environ.get('OHLC_RETENTION_DAYS', '180'))
    # Whale thresholds
    WHALE_HUMPBACK_XRP: float = float(os.environ.get('WHALE_HUMPBACK_XRP', '100000'))
    WHALE_SHARK_XRP: float = float(os.environ.get('WHALE_SHARK_XRP', '25000'))
    WHALE_DOLPHIN_XRP: float = float(os.environ.get('WHALE_DOLPHIN_XRP', '5000'))
    CORS_ORIGINS: str = os.environ.get('CORS_ORIGINS', '*')


settings = Settings()
