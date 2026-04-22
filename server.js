

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const xumm = require("xumm");

const app = express();
const PORT = process.env.PORT || 3000;

const XUMM_API_KEY = process.env.XUMM_API_KEY;
const XUMM_API_SECRET = process.env.XUMM_API_SECRET;

if (!XUMM_API_KEY || !XUMM_API_SECRET) {
  console.error("Missing XUMM_API_KEY or XUMM_API_SECRET in environment variables.");
  process.exit(1);
}

const xumm = new XummSdk(XUMM_API_KEY, XUMM_API_SECRET);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/**
 * Temporary in-memory subscription store.
 * Good enough for debugging wallet connect + flow.
 * Later you can move this into a database.
 */
const subscriptions = new Map();

/**
 * Helpers
 */
function safeCapitalize(value) {
  if (!value || typeof value !== "string") return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getSubscription(account) {
  if (!account) return null;
  return subscriptions.get(account) || null;
}

function setTrial(account) {
  const now = Date.now();
  const expiresAt = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();

  const sub = {
    account,
    plan: "basic",
    renewalPreference: "manual",
    isTrial: true,
    expiresAt
  };

  subscriptions.set(account, sub);
  return sub;
}

function setPaidPlan(account, plan, renewalPreference = "manual") {
  const now = Date.now();
  const expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();

  const sub = {
    account,
    plan,
    renewalPreference,
    isTrial: false,
    expiresAt
  };

  subscriptions.set(account, sub);
  return sub;
}

function payloadResponseToStatus(payload) {
  const resolved = !!payload?.meta?.resolved;
  const signed = !!payload?.meta?.signed;
  const opened = !!payload?.meta?.opened;
  const account =
    payload?.response?.account ||
    payload?.response?.txid_account ||
    payload?.application?.issued_user_token ||
    "";

  let stage = "created";
  if (resolved && signed) stage = "signed";
  else if (resolved && !signed) stage = "rejected";
  else if (opened) stage = "opened";

  return {
    resolved,
    signed,
    opened,
    account,
    stage
  };
}

/**
 * Health check
 */
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    message: "XRPL Money Machine server is running."
  });
});

/**
 * Create SignIn payload for wallet connect
 */
app.post("/api/connect/create", async (_req, res) => {
  try {
    const created = await xumm.payload.create({
      txjson: {
        TransactionType: "SignIn"
      },
      custom_meta: {
        identifier: "xrpl-money-machine-connect",
        instruction: "Sign in to XRPL Universal Money Machine"
      }
    });

    return res.json({
      ok: true,
      uuid: created?.uuid,
      next: created?.next?.always || "",
      qr: created?.refs?.qr_png || ""
    });
  } catch (error) {
    console.error("Connect payload create error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to create connect payload."
    });
  }
});

/**
 * Create SignIn payload for starting trial
 * We reuse SignIn so the user explicitly approves with the same wallet.
 */
app.post("/api/trial/create", async (req, res) => {
  try {
    const { connectedAccount } = req.body || {};

    if (!connectedAccount) {
      return res.status(400).json({
        ok: false,
        error: "Missing connectedAccount."
      });
    }

    const created = await xumm.payload.create({
      txjson: {
        TransactionType: "SignIn"
      },
      custom_meta: {
        identifier: "xrpl-money-machine-basic-trial",
        instruction: "Approve Basic 3 Day Free Trial",
        blob: {
          connectedAccount,
          action: "trial",
          plan: "basic"
        }
      }
    });

    return res.json({
      ok: true,
      uuid: created?.uuid,
      next: created?.next?.always || "",
      qr: created?.refs?.qr_png || ""
    });
  } catch (error) {
    console.error("Trial payload create error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to create trial payload."
    });
  }
});

/**
 * Create SignIn payload for paid plan activation
 * This is still a connect/approval flow for now.
 * You can later replace this with real payment txjson.
 */
app.post("/api/plan/create", async (req, res) => {
  try {
    const { plan, renewalPreference, connectedAccount } = req.body || {};

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
          connectedAccount,
          action: "plan",
          plan,
          renewalPreference: renewalPreference || "manual"
        }
      }
    });

    return res.json({
      ok: true,
      uuid: created?.uuid,
      next: created?.next?.always || "",
      qr: created?.refs?.qr_png || ""
    });
  } catch (error) {
    console.error("Plan payload create error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to create plan payload."
    });
  }
});

/**
 * Create SignIn payload for renewal
 */
app.post("/api/renew/create", async (req, res) => {
  try {
    const { plan, renewalPreference, connectedAccount } = req.body || {};

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
          connectedAccount,
          action: "renew",
          plan,
          renewalPreference: renewalPreference || "manual"
        }
      }
    });

    return res.json({
      ok: true,
      uuid: created?.uuid,
      next: created?.next?.always || "",
      qr: created?.refs?.qr_png || ""
    });
  } catch (error) {
    console.error("Renew payload create error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to create renewal payload."
    });
  }
});

/**
 * Poll payload status
 */
app.get("/api/payload-status/:uuid", async (req, res) => {
  try {
    const { uuid } = req.params;
    const payload = await xumm.payload.get(uuid);
    const status = payloadResponseToStatus(payload);

    return res.json({
      ok: true,
      ...status
    });
  } catch (error) {
    console.error("Payload status error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Unable to fetch payload status."
    });
  }
});

/**
 * Finalize action after signed payload
 * This removes ambiguity and avoids trusting only front-end state.
 */
app.post("/api/finalize", async (req, res) => {
  try {
    const { uuid, type, plan, renewalPreference } = req.body || {};

    if (!uuid) {
      return res.status(400).json({
        ok: false,
        error: "Missing uuid."
      });
    }

    const payload = await xumm.payload.get(uuid);
    const status = payloadResponseToStatus(payload);

    if (!status.resolved) {
      return res.status(400).json({
        ok: false,
        error: "Payload not resolved yet."
      });
    }

    if (!status.signed) {
      return res.status(400).json({
        ok: false,
        error: "Payload was rejected or cancelled."
      });
    }

    const account = status.account;

    if (!account) {
      return res.status(400).json({
        ok: false,
        error: "No wallet account returned by payload."
      });
    }

    if (type === "connect") {
      return res.json({
        ok: true,
        account
      });
    }

    if (type === "trial") {
      const sub = setTrial(account);
      return res.json({
        ok: true,
        account,
        plan: sub.plan,
        renewalPreference: sub.renewalPreference,
        expiresAt: sub.expiresAt,
        isTrial: sub.isTrial
      });
    }

    if (type === "plan" || type === "renew") {
      const sub = setPaidPlan(account, plan, renewalPreference || "manual");
      return res.json({
        ok: true,
        account,
        plan: sub.plan,
        renewalPreference: sub.renewalPreference,
        expiresAt: sub.expiresAt,
        isTrial: sub.isTrial
      });
    }

    return res.status(400).json({
      ok: false,
      error: "Invalid finalize type."
    });
  } catch (error) {
    console.error("Finalize error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to finalize payload."
    });
  }
});

/**
 * Read subscription by wallet
 */
app.get("/api/subscription/:account", (req, res) => {
  const { account } = req.params;
  const sub = getSubscription(account);

  if (!sub) {
    return res.json({
      ok: true,
      active: false
    });
  }

  return res.json({
    ok: true,
    active: true,
    ...sub
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
