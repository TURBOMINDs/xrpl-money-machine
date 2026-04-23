

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { Xumm } = require("xumm");

const app = express();
const PORT = process.env.PORT || 3000;

// Support either old env names (XUMM_*) or newer ones (XAMAN_*)
const API_KEY = process.env.XUMM_API_KEY || process.env.XAMAN_API_KEY;
const API_SECRET = process.env.XUMM_API_SECRET || process.env.XAMAN_API_SECRET;
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const RECEIVING_XRP_ADDRESS = process.env.RECEIVING_XRP_ADDRESS || "";

if (!API_KEY || !API_SECRET) {
  console.error(
    "Missing XUMM_API_KEY/XUMM_API_SECRET (or XAMAN_API_KEY/XAMAN_API_SECRET) in environment variables."
  );
  process.exit(1);
}

const xumm = new Xumm(API_KEY, API_SECRET);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/**
 * Simple in-memory stores for testing.
 * Later you can move these into a database.
 */
const subscriptions = new Map(); // account -> subscription
const pendingActions = new Map(); // uuid -> action metadata

function normalizeAccount(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeCapitalize(value) {
  if (!value || typeof value !== "string") return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function addDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function buildSubscription({
  account,
  plan,
  renewalPreference = "manual",
  isTrial = false,
  expiresAt = null
}) {
  return {
    account,
    plan,
    renewalPreference,
    isTrial,
    expiresAt,
    updatedAt: new Date().toISOString()
  };
}

function getSubscription(account) {
  return subscriptions.get(account) || null;
}

function setSubscription(sub) {
  subscriptions.set(sub.account, sub);
  return sub;
}

function getOpenLink(created) {
  return (
    created?.next?.always ||
    created?.next?.no_push_msg_received ||
    created?.next?.no_push_msg_received_web ||
    ""
  );
}

function getQrLink(created) {
  return (
    created?.refs?.qr_png ||
    created?.refs?.qr_matrix ||
    created?.refs?.qr_uri_quality_opts?.[0] ||
    ""
  );
}

app.get("/api/health", async (_req, res) => {
  try {
    const pong = await xumm.ping();
    res.json({
      ok: true,
      app: pong?.application?.name || "connected",
      publicBaseUrl: PUBLIC_BASE_URL,
      receivingAddress: RECEIVING_XRP_ADDRESS
    });
  } catch (err) {
    console.error("Ping failed:", err);
    res.status(500).json({
      ok: false,
      error: "Failed to reach Xaman."
    });
  }
});

app.get("/api/config", (_req, res) => {
  res.json({
    ok: true,
    publicBaseUrl: PUBLIC_BASE_URL,
    receivingAddress: RECEIVING_XRP_ADDRESS
  });
});

app.post("/api/connect/create", async (_req, res) => {
  try {
    const created = await xumm.payload.create({
      txjson: {
        TransactionType: "SignIn"
      },
      custom_meta: {
        identifier: "xrpl-money-machine-connect",
        instruction: "Approve SignIn in Xaman to connect your wallet.",
        blob: {
          type: "connect"
        }
      }
    });

    pendingActions.set(created.uuid, {
      type: "connect",
      createdAt: new Date().toISOString()
    });

    return res.json({
      ok: true,
      uuid: created.uuid,
      next: getOpenLink(created),
      qr: getQrLink(created)
    });
  } catch (err) {
    console.error("Connect create error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to create connect request."
    });
  }
});

app.post("/api/trial/start", (req, res) => {
  try {
    const connectedAccount = normalizeAccount(req.body?.connectedAccount);

    if (!connectedAccount) {
      return res.status(400).json({
        ok: false,
        error: "Missing connectedAccount."
      });
    }

    const existing = getSubscription(connectedAccount);

    if (existing?.isTrial) {
      return res.status(400).json({
        ok: false,
        error: "Trial already active for this wallet."
      });
    }

    const trial = buildSubscription({
      account: connectedAccount,
      plan: "basic",
      renewalPreference: "manual",
      isTrial: true,
      expiresAt: addDaysIso(3)
    });

    setSubscription(trial);

    return res.json({
      ok: true,
      ...trial
    });
  } catch (err) {
    console.error("Trial start error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to start trial."
    });
  }
});

app.post("/api/plan/create", async (req, res) => {
  try {
    const connectedAccount = normalizeAccount(req.body?.connectedAccount);
    const plan = req.body?.plan;
    const renewalPreference = req.body?.renewalPreference || "manual";

    if (!connectedAccount) {
      return res.status(400).json({
        ok: false,
        error: "Missing connectedAccount."
      });
    }

    if (!["basic", "plus", "pro"].includes(plan)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid plan."
      });
    }

    const created = await xumm.payload.create({
      txjson: {
        TransactionType: "SignIn"
      },
      custom_meta: {
        identifier: `xrpl-money-machine-plan-${plan}`,
        instruction: `Approve ${safeCapitalize(plan)} plan activation`,
        blob: {
          type: "plan",
          connectedAccount,
          plan,
          renewalPreference
        }
      }
    });

    pendingActions.set(created.uuid, {
      type: "plan",
      connectedAccount,
      plan,
      renewalPreference,
      createdAt: new Date().toISOString()
    });

    return res.json({
      ok: true,
      uuid: created.uuid,
      next: getOpenLink(created),
      qr: getQrLink(created)
    });
  } catch (err) {
    console.error("Plan create error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to create plan request."
    });
  }
});

app.post("/api/renew/create", async (req, res) => {
  try {
    const connectedAccount = normalizeAccount(req.body?.connectedAccount);
    const plan = req.body?.plan;
    const renewalPreference = req.body?.renewalPreference || "manual";

    if (!connectedAccount) {
      return res.status(400).json({
        ok: false,
        error: "Missing connectedAccount."
      });
    }

    if (!["basic", "plus", "pro"].includes(plan)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid plan."
      });
    }

    const created = await xumm.payload.create({
      txjson: {
        TransactionType: "SignIn"
      },
      custom_meta: {
        identifier: `xrpl-money-machine-renew-${plan}`,
        instruction: `Approve ${safeCapitalize(plan)} renewal`,
        blob: {
          type: "renew",
          connectedAccount,
          plan,
          renewalPreference
        }
      }
    });

    pendingActions.set(created.uuid, {
      type: "renew",
      connectedAccount,
      plan,
      renewalPreference,
      createdAt: new Date().toISOString()
    });

    return res.json({
      ok: true,
      uuid: created.uuid,
      next: getOpenLink(created),
      qr: getQrLink(created)
    });
  } catch (err) {
    console.error("Renew create error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to create renewal request."
    });
  }
});

app.get("/api/payload-status/:uuid", async (req, res) => {
  try {
    const uuid = req.params.uuid;
    const pending = pendingActions.get(uuid);

    if (!pending) {
      return res.status(404).json({
        ok: false,
        error: "Unknown payload UUID."
      });
    }

    const payload = await xumm.payload.get(uuid);
    const response = payload?.response || {};
    const account = normalizeAccount(response.account || "");

    const resolved = !!response.resolved;
    const signed = !!response.signed;

    if (!resolved) {
      return res.json({
        ok: true,
        resolved: false,
        signed: false,
        stage: "opened"
      });
    }

    if (!signed) {
      pendingActions.delete(uuid);
      return res.json({
        ok: true,
        resolved: true,
        signed: false,
        stage: "cancelled"
      });
    }

    if (pending.type === "connect") {
      pendingActions.delete(uuid);
      return res.json({
        ok: true,
        resolved: true,
        signed: true,
        stage: "connected",
        account
      });
    }

    if (pending.type === "plan" || pending.type === "renew") {
      const finalAccount = pending.connectedAccount || account;

      const sub = buildSubscription({
        account: finalAccount,
        plan: pending.plan,
        renewalPreference: pending.renewalPreference || "manual",
        isTrial: false,
        expiresAt: addDaysIso(30)
      });

      setSubscription(sub);
      pendingActions.delete(uuid);

      return res.json({
        ok: true,
        resolved: true,
        signed: true,
        stage: pending.type === "renew" ? "renewed" : "activated",
        account: finalAccount,
        plan: sub.plan,
        renewalPreference: sub.renewalPreference,
        expiresAt: sub.expiresAt,
        isTrial: sub.isTrial
      });
    }

    pendingActions.delete(uuid);

    return res.json({
      ok: true,
      resolved: true,
      signed: true,
      stage: "done",
      account
    });
  } catch (err) {
    console.error("Payload status error:", err);
    return res.status(500).json({
      ok: false,
      error: "Unable to fetch payload status."
    });
  }
});

app.get("/api/subscription/:account", (req, res) => {
  try {
    const account = normalizeAccount(req.params.account);

    if (!account) {
      return res.status(400).json({
        ok: false,
        error: "Missing account."
      });
    }

    const sub = getSubscription(account);

    return res.json({
      ok: true,
      subscription: sub
    });
  } catch (err) {
    console.error("Subscription fetch error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to fetch subscription."
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
