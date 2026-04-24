"""App settings loaded from env."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


class Settings:
    DATABASE_URL: str = os.environ.get(
        'DATABASE_URL',
        'postgresql+asyncpg://xrpl_user:xrpl_pass_secure_2025@localhost:5432/xrpl_money_machine',
    )
    XRPL_RPC_URL: str = os.environ.get('XRPL_RPC_URL', 'https://s1.ripple.com:51234/')
    XRPL_WS_URL: str = os.environ.get('XRPL_WS_URL', 'wss://s1.ripple.com')
    XAMAN_API_KEY: str = os.environ.get('XAMAN_API_KEY', 'mock_key_placeholder')
    XAMAN_API_SECRET: str = os.environ.get('XAMAN_API_SECRET', 'mock_secret_placeholder')
    XAMAN_MOCK_MODE: bool = os.environ.get('XAMAN_MOCK_MODE', 'true').lower() in ('1', 'true', 'yes')
    ONESIGNAL_APP_ID: str = os.environ.get('ONESIGNAL_APP_ID', 'mock_app_id_placeholder')
    ONESIGNAL_REST_API_KEY: str = os.environ.get('ONESIGNAL_REST_API_KEY', 'mock_rest_api_key_placeholder')
    ONESIGNAL_MOCK_MODE: bool = os.environ.get('ONESIGNAL_MOCK_MODE', 'true').lower() in ('1', 'true', 'yes')
    JWT_SECRET: str = os.environ.get('JWT_SECRET', 'dev-secret-change-me')
    JWT_ALGORITHM: str = os.environ.get('JWT_ALGORITHM', 'HS256')
    JWT_EXPIRE_HOURS: int = int(os.environ.get('JWT_EXPIRE_HOURS', '168'))
    SUBSCRIPTION_DEST_ADDRESS: str = os.environ.get(
        'SUBSCRIPTION_DEST_ADDRESS', 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'
    )
    CORS_ORIGINS: str = os.environ.get('CORS_ORIGINS', '*')


settings = Settings()
