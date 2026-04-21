

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { Xumm } = require("xumm");

const app = express();
const PORT = process.env.PORT || 3000;

const XAMAN_API_KEY = process.env.XAMAN_API_KEY;
const XAMAN_API_SECRET = process.env.XAMAN_API_SECRET;
const RECEIVING_XRP_ADDRESS = process.env.RECEIVING_XRP_ADDRESS;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

if (!XAMAN_API_KEY || !XAMAN_API_SECRET) {
  throw new Error("Missing XAMAN_API_KEY or XAMAN_API_SECRET in environment.");
}

if (!RECEIVING_XRP_ADDRESS) {
  throw new Error("Missing RECEIVING_XRP_ADDRESS in environment.");
}

const xumm = new Xumm(XAMAN_API_KEY, XAMAN_API_SECRET);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const payloadStore = new Map();

/**
 * Prices below are XRP placeholder values in DROPS:
 * 7 XRP  = 7000000
 * 15 XRP = 15000000
 * 25 XRP = 25000000
 *
 * Change these to your real production XRPL billing values.
 */
const PLANS = {
  basic: {
    label: "Basic",
    amountDrops: "7000000",
    durationMs: 30 * 24 * 60 * 60 * 1000
  },
  plus: {
    label: "Plus",
    amountDrops: "15000000",
    durationMs: 30 * 24 * 60 * 60 * 1000
  },
  pro: {
    label: "Pro",
    amountDrops: "25000000",
    durationMs: 30 * 24 * 60 * 60 * 1000
  }
};

function isoNow() {
  return new Date().toISOString();
}

function buildMemo(value) {
  return {
    Memo: {
      MemoData: Buffer.from(String(value), "utf8").toString("hex").toUpperCase()
    }
  };
}

async function createTrackedPayload({ payloadBody, kind, meta = {} }) {
  const localId = crypto.randomUUID();

  const tracked = {
    uuid: null,
    localId,
    kind,
    meta,
    createdAt: isoNow(),
    stage: "created",
    opened: false,
    resolved: false,
    signed: false,
    rejected: false,
    account: null,
    txid: null,
    next: null,
    qr: null,
    expiresAt: null,
    error: null
  };

  const subscription = await xumm.payload.createAndSubscribe(payloadBody, eventMessage => {
    if (!tracked.uuid) return;

    if (eventMessage?.data?.opened) {
      tracked.stage = "opened";
      tracked.opened = true;
      payloadStore.set(tracked.uuid, tracked);
    }

    if (Object.prototype.hasOwnProperty.call(eventMessage?.data || {}, "signed")) {
      tracked.stage = "resolved";
      tracked.resolved = true;
      tracked.signed = !!eventMessage.data.signed;
      tracked.rejected = !eventMessage.data.signed;
      payloadStore.set(tracked.uuid, tracked);
      return eventMessage;
    }
  });

  const { created, resolved } = subscription;

  tracked.uuid = created.uuid;
  tracked.next = created.next?.always || null;
  tracked.qr = created.refs?.qr_png || null;

  payloadStore.set(tracked.uuid, tracked);

  resolved
    .then(async () => {
      try {
        const full = await xumm.payload.get(created.uuid);

        tracked.resolved = true;
        tracked.stage = "resolved";
        tracked.signed = !!full?.response?.signed;
        tracked.rejected = full?.response?.signed === false;
        tracked.account = full?.response?.account || null;
        tracked.txid = full?.response?.txid || null;

        if (kind === "plan" || kind === "renew") {
          const { plan, renewalPreference, connectedAccount } = meta;
          const now = Date.now();
          const expiresAt = now + PLANS[plan].durationMs;

          tracked.plan = plan;
          tracked.renewalPreference = renewalPreference;
          tracked.startedAt = now;
          tracked.expiresAt = expiresAt;

          if (connectedAccount && tracked.account && connectedAccount !== tracked.account) {
            tracked.error = "Signed account does not match connected wallet.";
            tracked.signed = false;
          }
        }

        payloadStore.set(tracked.uuid, tracked);
      } catch (error) {
        tracked.error = error.message || "Failed to fetch resolved payload.";
        payloadStore.set(tracked.uuid, tracked);
      }
    })
    .catch(error => {
      tracked.error = error.message || "Payload resolution failed.";
      payloadStore.set(tracked.uuid, tracked);
    });

  return tracked;
}

app.get("/api/health", async (_req, res) => {
  try {
    const pong = await xumm.ping();
    res.json({ ok: true, pong });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/connect/create", async (_req, res) => {
  try {
    const payloadBody = {
      txjson: {
        TransactionType: "SignIn"
      },
      options: {
        return_url: {
          app: `${PUBLIC_BASE_URL}/?flow=connect&id={id}`,
          web: `${PUBLIC_BASE_URL}/?flow=connect&id={id}`
        }
      },
      custom_meta: {
        identifier: `connect-${Date.now()}`,
        instruction: "Sign in to connect your Xaman wallet."
      }
    };

    const tracked = await createTrackedPayload({
      payloadBody,
      kind: "connect"
    });

    res.json({
      ok: true,
      uuid: tracked.uuid,
      next: tracked.next,
      qr: tracked.qr
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || "Failed to create connect payload."
    });
  }
});

app.post("/api/plan/create", async (req, res) => {
  try {
    const { plan, renewalPreference, connectedAccount } = req.body || {};

    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ ok: false, error: "Invalid plan." });
    }

    if (!connectedAccount) {
      return res.status(400).json({ ok: false, error: "Connected wallet is required." });
    }

    if (!["manual", "auto_pref"].includes(renewalPreference)) {
      return res.status(400).json({ ok: false, error: "Invalid renewal preference." });
    }

    const payloadBody = {
      txjson: {
        TransactionType: "Payment",
        Destination: RECEIVING_XRP_ADDRESS,
        Amount: PLANS[plan].amountDrops,
        Memos: [
          buildMemo(`product:XRPL Universal Money Machine`),
          buildMemo(`plan:${plan}`),
          buildMemo(`renewal:${renewalPreference}`),
          buildMemo(`term:30days`)
        ]
      },
      options: {
        return_url: {
          app: `${PUBLIC_BASE_URL}/?flow=plan&id={id}`,
          web: `${PUBLIC_BASE_URL}/?flow=plan&id={id}`
        }
      },
      custom_meta: {
        identifier: `${plan}-${Date.now()}`,
        instruction: `Approve payment to start ${PLANS[plan].label} plan for 30 days.`
      }
    };

    const tracked = await createTrackedPayload({
      payloadBody,
      kind: "plan",
      meta: {
        plan,
        renewalPreference,
        connectedAccount
      }
    });

    res.json({
      ok: true,
      uuid: tracked.uuid,
      next: tracked.next,
      qr: tracked.qr
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || "Failed to create plan payload."
    });
  }
});

app.post("/api/renew/create", async (req, res) => {
  try {
    const { plan, renewalPreference, connectedAccount } = req.body || {};

    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ ok: false, error: "Invalid plan for renewal." });
    }

    if (!connectedAccount) {
      return res.status(400).json({ ok: false, error: "Connected wallet is required." });
    }

    if (!["manual", "auto_pref"].includes(renewalPreference)) {
      return res.status(400).json({ ok: false, error: "Invalid renewal preference." });
    }

    const payloadBody = {
      txjson: {
        TransactionType: "Payment",
        Destination: RECEIVING_XRP_ADDRESS,
        Amount: PLANS[plan].amountDrops,
        Memos: [
          buildMemo(`product:XRPL Universal Money Machine`),
          buildMemo(`renewal_of:${plan}`),
          buildMemo(`renewal:${renewalPreference}`),
          buildMemo(`term:30days`)
        ]
      },
      options: {
        return_url: {
          app: `${PUBLIC_BASE_URL}/?flow=renew&id={id}`,
          web: `${PUBLIC_BASE_URL}/?flow=renew&id={id}`
        }
      },
      custom_meta: {
        identifier: `renew-${plan}-${Date.now()}`,
        instruction: `Approve payment to renew ${PLANS[plan].label} for another 30 days.`
      }
    };

    const tracked = await createTrackedPayload({
      payloadBody,
      kind: "renew",
      meta: {
        plan,
        renewalPreference,
        connectedAccount
      }
    });

    res.json({
      ok: true,
      uuid: tracked.uuid,
      next: tracked.next,
      qr: tracked.qr
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || "Failed to create renewal payload."
    });
  }
});

app.get("/api/payload-status/:uuid", (req, res) => {
  const tracked = payloadStore.get(req.params.uuid);

  if (!tracked) {
    return res.status(404).json({ ok: false, error: "Payload not found." });
  }

  res.json({
    ok: true,
    uuid: tracked.uuid,
    stage: tracked.stage,
    opened: tracked.opened,
    resolved: tracked.resolved,
    signed: tracked.signed,
    rejected: tracked.rejected,
    account: tracked.account,
    txid: tracked.txid,
    plan: tracked.plan || null,
    renewalPreference: tracked.renewalPreference || null,
    expiresAt: tracked.expiresAt || null,
    error: tracked.error || null
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
