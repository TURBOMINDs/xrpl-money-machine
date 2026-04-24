# XRPL Universal Money Machine — plan.md (UPDATED)

## 1) Objectives
- Deliver a premium **XRPL AMM tracking + alert** web app using **React + FastAPI + PostgreSQL**.
- Provide wallet-based identity via **Xaman** (implemented in **mock mode** first; production switch planned).
- Provide tiered subscriptions (**Basic/Plus/Ultimate**) via **Xaman XRP payment payloads** with backend verification.
- Track XRPL AMM/LP accounts with subscription-enforced slot limits and show:
  - Live alert feed (liquidity surges, whale/shark events)
  - Whale/rank detection & per-rank alert toggles (8 ranks)
  - Price alerts (above/below/% change) with browser notifications + OneSignal (mock initially)
  - Candlestick chart rendering (synthetic OHLCV in V1; production time-series planned)
- Execution strategy: **prove core integrations first (POC)**, then build complete V1 app, then harden and prepare production integrations.

**Current status (as of this update):**
- ✅ Phase 1 POC completed (5/5 checks passing)
- ✅ Phase 2 V1 app build completed (backend + frontend)
- ✅ Phase 3 testing completed (Iteration 2: Backend 95%—expected behavior; Frontend 100%)
- ▶ Phase 4 ready (deliverables + production guidance)

---

## 2) Implementation Steps

### Phase 1 — Core POC (isolation, must be green before Phase 2)
**Goal:** validate the failure-prone integrations + data model with a single script: `/app/test_core.py`.

1. **Web research (best practices quick pass)**
   - XRPL AMM data access patterns with `xrpl-py` (AMMInfo, account_lines, account_tx).
   - Xaman payload lifecycle (create → status/poll/webhook → signed outcome).
   - OneSignal web push: device/player binding + server REST send.

2. **Backend POC deps + DB wiring**
   - Installed: `sqlalchemy[asyncio]`, `asyncpg`, `httpx`, `xrpl-py`, `apscheduler`, `pydantic-settings`, `alembic`.
   - PostgreSQL running with `DATABASE_URL=postgresql+asyncpg://xrpl_user:...@localhost:5432/xrpl_money_machine`.

3. **POC script checks (must all pass)**
   - Postgres async connect → create tables → insert/read.
   - XRPL mainnet JSON-RPC query: fetch real AMM info.
   - Rank classification: fetch XRP balance for a real XRPL address → map to rank.
   - Mock Xaman lifecycle: create payload UUID → poll status → resolve signed.
   - Price fetch: multi-source fallback (Bitstamp/Kraken/CoinCap; avoids CoinGecko 429).

4. **Exit criteria**
   - `python /app/test_core.py` prints PASS for all 5 checks.

**Status:** ✅ COMPLETED (5/5)

**Phase 1 user stories (POC-level):** ✅ all satisfied
1. Connect to Postgres and persist a record.
2. Fetch real XRPL AMM info.
3. Classify XRPL address into whale rank.
4. Create and resolve mock Xaman sign-in payload.
5. Fetch spot price data.

---

### Phase 2 — V1 App Build (MVP UI + working core flows; mock auth/payments)
**Goal:** build a usable dashboard matching reference screenshots: sign-in, subscribe, track pairs, live alerts, rank preferences, price alerts modal, notifications.

1. **Backend (FastAPI) — build around proven POC**
   - Implemented async SQLAlchemy Postgres backend.
   - Implemented models: users, subscriptions, payment_intents, amm_pairs, alerts, alert_events, holder_rank_configs, xaman_sessions, onesignal_devices.
   - Implemented services:
     - `xrpl_service.py` for XRPL node queries + heuristics
     - `xaman_service.py` mock payload store + real-mode structure
     - `price_service.py` multi-source XRP/USD price
     - `onesignal_service.py` mock push logging + real-mode structure
     - `worker.py` background polling loop
   - Routers implemented and mounted under `/api`:
     - auth (Xaman)
     - subscriptions
     - amm
     - alerts
     - ranks
     - notifications

2. **Background worker (polling MVP)**
   - Implemented async worker loop every 30s:
     - Poll tracked AMM/LP accounts
     - Liquidity surge detection (reserve change threshold)
     - Whale/shark buy/sell heuristics from recent txs
     - Price-alert evaluation (above/below) vs live XRP/USD
     - Emits `alert_events` + pushes to OneSignal devices (mock or real)

3. **Frontend (React + Tailwind + shadcn)**
   - Implemented routes/pages:
     - `/` Landing
     - `/dashboard`
     - `/pair/:id`
     - `/alerts`
     - `/subscribe`
     - `/settings`
   - Implemented phoenix/fire theme + fonts (Orbitron/Manrope/Azeret Mono), dark-only tokens, neon accents.
   - Implemented key components:
     - TopNav
     - XamanLoginButton (QR modal + mock simulate sign)
     - TierCard
     - SubscribePaymentModal (QR + mock simulate payment)
     - PairInputForm (AMM/LP input + “Use demo address”)
     - LiveAlertsPanel (polling feed)
     - RankCard + RanksGrid (8 ranks + toggles)
     - CandlestickChart (Recharts)
     - PriceAlertsModal (magenta/violet subsystem)

4. **V1 limits + UX rules**
   - Server-side slot limits enforced by tier.
   - Mock-mode banners and deterministic demo addresses included.
   - Magenta/violet styling scoped to Price Alerts modal only.

**Status:** ✅ COMPLETED

**Phase 2 user stories:** ✅ all satisfied
1. Landing page shows hero + pricing + live alerts.
2. Xaman mock login works and routes to dashboard.
3. Start Basic free trial updates subscription badge and slot limits.
4. Add AMM/LP address creates tracked pair and displays it.
5. Price Alerts modal creates above/below/% alerts.
6. Notifications: browser permissions + OneSignal info/test (mock) works.

---

### Phase 3 — Hardening + Production-readiness (testing + fix pass; real integrations next)
**Goal:** stabilize V1 and prepare pathway to real Xaman / OneSignal / stronger alert accuracy.

1. **Testing**
   - Ran testing agent twice.
   - Iteration 1 surfaced UI issues:
     - PriceAlertsModal overlay blocking navigation (nested trigger)
     - Candlestick chart width/height issues
     - TopNav address badge visibility
   - All issues fixed.

2. **Fixes applied (Iteration 2 verified)**
   - PriceAlertsModal: DialogTrigger uses `asChild` to avoid nested buttons; overlay no longer blocks navigation.
   - CandlestickChart: added explicit container sizing + minWidth/minHeight.
   - TopNav: address badge always visible; nav labels consistently visible.

3. **Test results**
   - Backend: **95%** (19/20) — only “failure” is expected behavior: trial endpoint correctly blocks starting a trial if subscription is already active.
   - Frontend: **100%** pass after fixes.

**Status:** ✅ COMPLETED

**Phase 3 user stories (testing/hardening):** ✅ satisfied for V1 scope

---

### Phase 4 — Enhancements + Handoff (optional but recommended)
**Goal:** finalize deliverables and document production switch steps. Define next milestones.

1. **Deliverables summary (handoff)**
   - Architecture summary (React + FastAPI + Postgres)
   - File structure
   - Setup instructions (local + Render)
   - Environment variables required for production
   - Test steps and smoke checklist

2. **Production switches (planned)**
   - **Xaman (real mode)**
     - Set `XAMAN_MOCK_MODE=false`
     - Provide `XAMAN_API_KEY` + `XAMAN_API_SECRET`
     - Replace mock resolve endpoints with webhook/poll verification
   - **OneSignal (real mode)**
     - Set `ONESIGNAL_MOCK_MODE=false`
     - Provide `ONESIGNAL_APP_ID` + `ONESIGNAL_REST_API_KEY`
     - Add real OneSignal Web SDK device registration (player_id capture) and link to user

3. **OHLCV chart production plan (recommended)**
   - Current V1 uses deterministic synthetic OHLCV due to public XRPL node limitations.
   - Production approach:
     - Worker persists periodic pool-derived price snapshots to Postgres (or a time-series DB)
     - Aggregate to OHLCV per timeframe server-side

4. **Future enhancements (optional)**
   - Replace polling with WebSockets/SSE for real-time alerts.
   - Better AMM analytics: TVL, volume 24h, fee APR, swap counts.
   - Admin tools: alert replay, user/subscription management.

**Status:** ▶ READY TO COMPLETE

---

## 3) Next Actions (immediate)
1. ✅ POC complete.
2. ✅ V1 backend + frontend complete.
3. ✅ Testing complete.
4. **Finalize Phase 4**:
   - Write deliverables/readme instructions
   - Provide environment variable checklist
   - Provide production switch guide for Xaman + OneSignal
   - (Optional) add time-series persistence for real OHLCV

---

## 4) Success Criteria
- **POC:** ✅ all 5 checks pass with real XRPL endpoints and Postgres writes.
- **V1:** ✅ user can sign in (mock), start trial, subscribe (mock payment), add tracked pairs, see alerts/events, create price alerts, enable notifications.
- **Security:** ✅ Xaman secret never exposed to frontend; payload creation server-side only.
- **UX:** ✅ tier limits enforced; premium phoenix theme; all critical UI bugs fixed.
- **Production readiness:** ⏳ pending user-provided Xaman + OneSignal credentials and enabling real-mode integrations.
