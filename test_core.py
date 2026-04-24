"""
XRPL Universal Money Machine - Core POC Test Script

Validates the 5 critical integrations BEFORE building the full app:
1. PostgreSQL async connection + table create + insert + read
2. XRPL node connection + fetch real AMM info
3. Holder rank classification from real XRPL balance
4. Mock Xaman payload lifecycle (create + poll + resolve)
5. Price fetch (CoinGecko/XRPScan fallback)

Run: python /app/test_core.py
Exit code 0 = all green. Anything else = failed.
"""

import asyncio
import json
import logging
import sys
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Dict, List, Optional

import httpx
from sqlalchemy import Column, String, DateTime, Float, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

# xrpl-py
from xrpl.asyncio.clients import AsyncJsonRpcClient
from xrpl.models.requests import AccountInfo, AMMInfo, AccountLines
from xrpl.utils import drops_to_xrp

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("poc")

# ──────────────────────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────────────────────
POSTGRES_URL = "postgresql+asyncpg://xrpl_user:xrpl_pass_secure_2025@localhost:5432/xrpl_money_machine"
XRPL_RPC = "https://s1.ripple.com:51234/"   # mainnet JSON-RPC
# Well-known XRPL mainnet addresses with healthy balances
TEST_ACCOUNT = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh"  # Ripple foundation-ish, always funded
# A well-known mainnet AMM: XRP / USD (Bitstamp issuer) — stable for years
# Use AMMInfo by asset pair (more reliable than guessing AMM account):
AMM_ASSET_1 = {"currency": "XRP"}
AMM_ASSET_2 = {"currency": "USD", "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B"}  # Bitstamp USD

# ──────────────────────────────────────────────────────────────────────────────
# SQLAlchemy model (POC-sized)
# ──────────────────────────────────────────────────────────────────────────────
Base = declarative_base()

class POCUser(Base):
    __tablename__ = "poc_users"
    id = Column(String, primary_key=True)
    xrpl_address = Column(String, nullable=False)
    xrp_balance = Column(Float, default=0.0)
    rank = Column(String, default="shrimp")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ──────────────────────────────────────────────────────────────────────────────
# Rank classification (per problem statement)
# ──────────────────────────────────────────────────────────────────────────────
def classify_rank(xrp_balance: float) -> str:
    if xrp_balance >= 100_000:
        return "humpback"
    if xrp_balance >= 50_000:
        return "whale"
    if xrp_balance >= 25_000:
        return "shark"
    if xrp_balance >= 7_000:
        return "orca"
    if xrp_balance >= 5_000:
        return "dolphin"
    if xrp_balance >= 2_000:
        return "octopus"
    if xrp_balance >= 500:
        return "crab"
    return "shrimp"


# ──────────────────────────────────────────────────────────────────────────────
# Mock Xaman service (in-memory for POC)
# ──────────────────────────────────────────────────────────────────────────────
class MockXamanStore:
    def __init__(self):
        self.payloads: Dict[str, Dict] = {}

    def create_signin(self, return_url: str) -> Dict:
        pid = str(uuid.uuid4())
        self.payloads[pid] = {
            "uuid": pid,
            "status": "pending",
            "type": "signin",
            "signed": False,
            "address": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
            "return_url": return_url,
        }
        return {
            "uuid": pid,
            "status": "pending",
            "next": {"always": f"xumm://payload/{pid}"},
            "refs": {
                "qr_png": f"https://xumm.app/sign/{pid}.png",
                "qr_url": f"https://xumm.app/sign/{pid}",
            },
        }

    def get_status(self, pid: str) -> Dict:
        p = self.payloads.get(pid)
        if not p:
            return {"uuid": pid, "status": "unknown", "error": "not_found"}
        return {
            "uuid": pid,
            "status": p["status"],
            "signed": p["signed"],
            "address": p["address"],
            "type": p["type"],
        }

    def resolve_signed(self, pid: str, address: str) -> Dict:
        if pid not in self.payloads:
            raise ValueError("payload not found")
        self.payloads[pid]["status"] = "signed"
        self.payloads[pid]["signed"] = True
        self.payloads[pid]["address"] = address
        return self.get_status(pid)


# ──────────────────────────────────────────────────────────────────────────────
# Checks
# ──────────────────────────────────────────────────────────────────────────────
async def check_postgres() -> bool:
    log.info("── [1] PostgreSQL async connection + CRUD ──")
    engine = create_async_engine(POSTGRES_URL, echo=False)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as s:
            u = POCUser(
                id=str(uuid.uuid4()),
                xrpl_address="rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
                xrp_balance=123456.0,
                rank="humpback",
            )
            s.add(u)
            await s.commit()
            res = await s.execute(text("SELECT COUNT(*) FROM poc_users"))
            count = res.scalar_one()
            log.info(f"   inserted 1 user, table count={count}")
            assert count == 1
        await engine.dispose()
        log.info("✅ [1] PostgreSQL OK")
        return True
    except Exception as e:
        log.exception(f"❌ [1] PostgreSQL FAILED: {e}")
        return False


async def check_xrpl_amm() -> bool:
    log.info("── [2] XRPL mainnet AMM info ──")
    client = AsyncJsonRpcClient(XRPL_RPC)
    try:
        req = AMMInfo(asset=AMM_ASSET_1, asset2=AMM_ASSET_2)
        resp = await client.request(req)
        data = resp.result
        if "amm" not in data:
            # Try alternative: fetch any AMM via simpler approach
            log.warning(f"   AMM not found for XRP/USD(Bitstamp), response: {list(data.keys())}")
            # Fallback: try RLUSD issuer
            alt = {"currency": "524C555344000000000000000000000000000000", "issuer": "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De"}
            req2 = AMMInfo(asset=AMM_ASSET_1, asset2=alt)
            resp = await client.request(req2)
            data = resp.result
        assert "amm" in data, f"no amm in response: {data}"
        amm = data["amm"]
        log.info(f"   AMM account: {amm.get('account')}")
        log.info(f"   LP token supply: {amm.get('lp_token', {}).get('value', 'n/a')}")
        log.info(f"   Trading fee: {amm.get('trading_fee', 'n/a')}")
        log.info("✅ [2] XRPL AMM OK")
        return True
    except Exception as e:
        log.exception(f"❌ [2] XRPL AMM FAILED: {e}")
        return False


async def check_rank_classification() -> bool:
    log.info("── [3] Rank classification from XRPL account balance ──")
    client = AsyncJsonRpcClient(XRPL_RPC)
    try:
        req = AccountInfo(account=TEST_ACCOUNT, ledger_index="validated")
        resp = await client.request(req)
        drops = resp.result["account_data"]["Balance"]
        xrp = float(drops_to_xrp(drops))
        rank = classify_rank(xrp)
        log.info(f"   {TEST_ACCOUNT} balance={xrp:,.2f} XRP rank={rank}")
        # sanity: classifier returns valid rank
        assert rank in {"shrimp", "crab", "octopus", "dolphin", "orca", "shark", "whale", "humpback"}
        # test thresholds
        assert classify_rank(0) == "shrimp"
        assert classify_rank(500) == "crab"
        assert classify_rank(2000) == "octopus"
        assert classify_rank(25000) == "shark"
        assert classify_rank(100000) == "humpback"
        log.info("✅ [3] Rank classification OK")
        return True
    except Exception as e:
        log.exception(f"❌ [3] Rank classification FAILED: {e}")
        return False


async def check_mock_xaman() -> bool:
    log.info("── [4] Mock Xaman payload lifecycle ──")
    try:
        store = MockXamanStore()
        payload = store.create_signin(return_url="https://app.example.com/return")
        pid = payload["uuid"]
        log.info(f"   created payload {pid}, qr={payload['refs']['qr_url']}")

        status = store.get_status(pid)
        assert status["status"] == "pending"
        assert status["signed"] is False

        # simulate wallet signing
        resolved = store.resolve_signed(pid, address="rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY")
        assert resolved["signed"] is True
        assert resolved["address"].startswith("r")
        log.info(f"   resolved → address={resolved['address']}")

        # unknown payload → graceful
        unknown = store.get_status("does-not-exist")
        assert unknown["status"] == "unknown"
        log.info("✅ [4] Mock Xaman lifecycle OK")
        return True
    except Exception as e:
        log.exception(f"❌ [4] Mock Xaman FAILED: {e}")
        return False


async def check_price_fetch() -> bool:
    """Try multiple price sources with fallback chain."""
    log.info("── [5] Price fetch (multi-source with fallbacks) ──")
    sources = [
        ("Bitstamp",
         "https://www.bitstamp.net/api/v2/ticker/xrpusd/",
         lambda d: float(d["last"])),
        ("Kraken",
         "https://api.kraken.com/0/public/Ticker?pair=XRPUSD",
         lambda d: float(list(d["result"].values())[0]["c"][0])),
        ("CoinCap",
         "https://api.coincap.io/v2/assets/xrp",
         lambda d: float(d["data"]["priceUsd"])),
        ("CoinGecko",
         "https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd",
         lambda d: float(d["ripple"]["usd"])),
    ]
    async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": "XRPL-UMM/1.0"}) as hc:
        for name, url, extractor in sources:
            try:
                r = await hc.get(url)
                if r.status_code != 200:
                    log.warning(f"   {name}: HTTP {r.status_code}, trying next…")
                    continue
                price = extractor(r.json())
                if price <= 0 or price >= 1000:
                    log.warning(f"   {name}: invalid price {price}, trying next…")
                    continue
                log.info(f"   {name}: XRP/USD = ${price:.4f}")
                log.info("✅ [5] Price fetch OK")
                return True
            except Exception as e:
                log.warning(f"   {name} failed: {e}")
                continue
    log.error("❌ [5] Price fetch FAILED: all sources unavailable")
    return False


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────
async def main() -> int:
    log.info("═══════════════════════════════════════════════════════════")
    log.info("  XRPL Universal Money Machine — Core POC")
    log.info("═══════════════════════════════════════════════════════════")

    results = {
        "postgres": await check_postgres(),
        "xrpl_amm": await check_xrpl_amm(),
        "rank_classification": await check_rank_classification(),
        "mock_xaman": await check_mock_xaman(),
        "price_fetch": await check_price_fetch(),
    }

    log.info("")
    log.info("══════════════════ SUMMARY ══════════════════")
    for name, ok in results.items():
        flag = "✅" if ok else "❌"
        log.info(f"  {flag}  {name}")
    passed = sum(results.values())
    log.info(f"  → {passed}/{len(results)} passed")

    return 0 if all(results.values()) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
