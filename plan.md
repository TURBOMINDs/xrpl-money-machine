# XRPL Universal Money Machine — plan.md

## 1) Objectives
- Deliver a premium XRPL AMM tracking + alert web app (React + FastAPI + PostgreSQL).
- Wallet-based identity via **Xaman** (start in **mock mode**, swap to real keys later).
- Tiered subscriptions (Basic/Plus/Ultimate) via **Xaman XRP payment payloads** with backend verification.
- Track AMM pairs (slot limits per tier), live alert feed, whale/rank detection, price alerts (browser + OneSignal).
- Core-first delivery: prove XRPL + Postgres + mock Xaman + pricing/alerts plumbing in isolation before building UI.

---

## 2) Implementation Steps

### Phase 1 — Core POC (isolation, must be green before Phase 2)
**Goal:** validate the failure-prone integrations + data model with a single script: `/app/test_core.py`.

1. **Web research (best practices quick pass)**
   - XRPL AMM data access patterns with `xrpl-py` (AMMInfo, tx stream, ledger queries).
   - Xaman payload lifecycle (create → status/poll/webhook → signed outcome).
   - OneSignal web push: device/player binding + server REST send.

2. **Backend POC deps + DB wiring**
   - Add: `sqlalchemy[asyncio]`, `asyncpg`, `alembic` (optional), `httpx`, `xrpl-py`, `apscheduler`, `python-jose`, `pydantic-settings`.
   - Configure `DATABASE_URL=postgresql+asyncpg://xrpl_user:...@localhost:5432/xrpl_money_machine`.
   - Create minimal SQLAlchemy models needed for POC: `users`, `payment_intents`, `subscriptions`, `amm_pairs`, `alerts`, `alert_events`.

3. **POC script checks (must all pass)**
   - Postgres async connect → create tables → insert/read.
   - XRPL node query (wss endpoint): fetch **one real AMM** info (or fallback to token pair stats via 3rd-party API).
   - Rank classification: fetch XRP balance for a real address → map to Shrimp/Crab/Octopus/Shark/Humpback.
   - Mock Xaman lifecycle: create payload UUID → poll status → resolve signed (simulate).
   - Price fetch: CoinGecko/Sologenic spot price fetch for XRP (and token if available).

4. **Exit criteria**
   - `python /app/test_core.py` prints PASS for all 5 checks twice in a row.

**Phase 1 user stories (POC-level):**
1. As a developer, I can connect to Postgres and persist a user record.
2. As a developer, I can fetch real XRPL AMM/pool or DEX pricing data.
3. As a developer, I can classify an XRPL address into a whale rank by XRP balance.
4. As a developer, I can create and resolve a mock Xaman sign-in payload.
5. As a developer, I can fetch spot price data used for alerts/subscription FX.

---

### Phase 2 — V1 App Build (MVP UI + working core flows; mock auth/payments)
**Goal:** build a usable dashboard matching screenshots: sign-in, subscribe, track pairs, alerts feed, price alert modal, OneSignal opt-in.

1. **Backend (FastAPI) — build around proven POC**
   - Replace Mongo usage entirely; introduce `database.py`, `models.py`, `schemas.py`.
   - Services: `xrpl_service.py` (node + 3rd party fallbacks), `xaman_service.py` (mock/real), `onesignal_service.py`.
   - Routers (minimal but complete): `auth`, `subscriptions`, `amm`, `alerts`, `notifications`, `ranks`.
   - Auth in V1: JWT (HttpOnly cookie) issued after mock Xaman sign; keep interfaces identical for real Xaman later.

2. **Background worker (polling MVP)**
   - APScheduler jobs:
     - Poll tracked AMM/pairs (30–60s) → liquidity/price change detection → insert `alert_events`.
     - Tx scan (60s+) → classify whale buy/sell by size thresholds.
     - Price alerts evaluation (30s) for above/below/%.

3. **Frontend (React + Tailwind + shadcn)**
   - Routes: `/` landing, `/dashboard`, `/subscribe`, `/pair/:id`, `/alerts`, `/settings`.
   - Core components (match ref): pricing tier cards, track pair form, live alerts panel, ranks grid toggles, price alerts modal, candlestick chart.
   - Integrate OneSignal Web SDK (guarded by env); fallback to browser Notification API.
   - Realtime-ish updates: polling `/api/alerts/events` every few seconds for live feed (WebSockets later).

4. **V1 limits + UX rules**
   - Enforce tier slot limits server-side; return actionable errors; frontend shows upgrade prompts.
   - Maintain “mock mode” banner + deterministic demo addresses.

5. **End Phase 2 testing (1 full pass)**
   - Run testing agent against key flows and fix blocking UX/data bugs.

**Phase 2 user stories:**
1. As a visitor, I can view the phoenix landing page with pricing tiers and a live alerts panel.
2. As a visitor, I can sign in via Xaman mock flow and land in my dashboard.
3. As a user, I can start a Basic free trial and see my slot limits update.
4. As a user, I can add an AMM/LP address as a tracked pair and see it appear in my list.
5. As a user, I can open the Price Alerts modal and create an “above/below/% change” alert.
6. As a user, I can enable notifications and receive a test push (OneSignal or browser fallback).

---

### Phase 3 — Hardening + Production-readiness (real integrations, better alert accuracy)
**Goal:** turn mock flows into real, improve correctness, and reduce false alerts.

1. **Xaman real mode switch**
   - Add env-driven Xaman client; implement webhook callback verification; store sessions in `xaman_sessions`.
   - Ensure secrets never reach frontend; all payloads created/validated server-side.

2. **Subscription payments verification (real XRPL)**
   - Payment payload includes destination + memo (intent id) for reconciliation.
   - Verify tx hash on-ledger before activating; handle pending/expired/rejected.

3. **Alert quality improvements**
   - Improve AMM transaction parsing; thresholds per tier; dedupe + rate-limit `alert_events`.
   - Store minimal `payload_json` in `alert_events` for replay/debug while keeping core data relational.

4. **Testing (1 full pass)**
   - Call testing agent again; resolve regressions.

**Phase 3 user stories:**
1. As a user, I can sign in with real Xaman and my session persists securely.
2. As a user, I can pay via Xaman and my subscription activates only after on-ledger verification.
3. As a user, I can see fewer duplicate alerts due to dedupe and cooldown rules.
4. As a user, I can manage alert toggles and see changes applied in the live feed.
5. As a user, I can reliably receive pushes tied to my account/device.

---

### Phase 4 — Enhancements (optional but recommended)
- Replace polling feed with WebSockets/SSE for true real-time.
- Add advanced analytics on pair pages (TVL, volume, fee APR).
- Add admin tools: alert replay, user/subscription viewer.

---

## 3) Next Actions (immediate)
1. Implement `/app/test_core.py` and required backend deps.
2. Add Postgres SQLAlchemy async base + minimal models.
3. Implement XRPL AMM + price fetch helpers with fallbacks.
4. Implement mock Xaman payload create/poll/resolve.
5. Run POC until fully green; only then start Phase 2 app build.

---

## 4) Success Criteria
- **POC:** all 5 checks pass reliably with real XRPL endpoints and Postgres writes.
- **V1:** user can sign in (mock), start trial/subscribe (mock payment), add tracked pairs, see alerts/events, create price alerts, enable notifications.
- **Security:** Xaman secret never in frontend; backend verifies payload results/tx before access.
- **UX:** tier limits enforced with clear upgrade prompts; dashboard usable and stable.
