import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TRACKED_ENV = [
  "DATABASE_URL",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_SECRET",
  "PAYPAL_ENV",
  "PAYPAL_WEBHOOK_ID",
  "PAYPAL_WEBHOOK_SECRET",
  "VYRDX_LAUNCH_EVENT_LOG",
] as const;

const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("../server/db.js");
  vi.doUnmock("../server/vyrdx/domain/runtime-config.js");
  savedEnv.clear();
  for (const key of TRACKED_ENV) {
    savedEnv.set(key, process.env[key]);
  }
  process.env["VYRDX_LAUNCH_EVENT_LOG"] = join(mkdtempSync(join(tmpdir(), "vyrdx-provider-test-")), "events.jsonl");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  for (const key of TRACKED_ENV) {
    const value = savedEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

async function createPaymentApp() {
  const { registerPaymentRoutes } = await import("../server/api/payments.js");
  const app = Fastify();
  await registerPaymentRoutes(app);
  return app;
}

function signPaypalBody(body: Record<string, unknown>, secret: string) {
  const transmissionId = "transmission-test-1";
  const transmissionTime = "2026-05-07T00:00:00Z";
  const signature = createHmac("sha256", secret)
    .update(`${transmissionId}.${transmissionTime}.${JSON.stringify(body)}`)
    .digest("hex");
  return {
    "paypal-transmission-id": transmissionId,
    "paypal-transmission-time": transmissionTime,
    "paypal-transmission-sig": signature,
  };
}

describe("payment providers", () => {
  it("blocks PayPal order creation with structured runtime config when env is missing", async () => {
    delete process.env["PAYPAL_CLIENT_ID"];
    delete process.env["PAYPAL_SECRET"];
    delete process.env["PAYPAL_ENV"];
    delete process.env["PAYPAL_WEBHOOK_ID"];
    delete process.env["PAYPAL_WEBHOOK_SECRET"];

    const app = await createPaymentApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/payments/paypal/create-order",
        payload: { invoiceId: "pyr_invoice_1" },
      });

      expect(response.statusCode).toBe(503);
      const payload = response.json();
      expect(payload).toMatchObject({
        error: "INCOMPLETE_RUNTIME_CONFIG",
        decision: "INCOMPLETE_RUNTIME_CONFIG",
        status: "FAIL_CLOSED",
        provider: "paypal",
        nextAction: "SET_ENV_VARS_AND_RERUN_SMOKE",
      });
      expect(payload.missingConfig).toContain("PAYPAL_CLIENT_ID");
      expect(payload.missingConfig).toContain("PAYPAL_SECRET");
      expect(payload.missingConfig).toContain("PAYPAL_ENV");
    } finally {
      await app.close();
    }
  });

  it("blocks bank and BTC provider instructions without invoiceId", async () => {
    const app = await createPaymentApp();
    try {
      const bank = await app.inject({
        method: "GET",
        url: "/api/v1/payments/bank/instructions",
      });
      const btc = await app.inject({
        method: "GET",
        url: "/api/v1/payments/btc/address",
      });

      expect(bank.statusCode).toBe(400);
      expect(bank.json()).toMatchObject({ error: "invoiceId_required" });
      expect(btc.statusCode).toBe(400);
      expect(btc.json()).toMatchObject({ error: "invoiceId_required" });
    } finally {
      await app.close();
    }
  });

  it("rejects PayPal webhooks with invalid signatures before matching invoices", async () => {
    process.env["PAYPAL_WEBHOOK_SECRET"] = "test_webhook_secret";
    const app = await createPaymentApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/payments/paypal/webhook",
        headers: {
          "paypal-transmission-id": "transmission-test-1",
          "paypal-transmission-time": "2026-05-07T00:00:00Z",
          "paypal-transmission-sig": "bad-signature",
        },
        payload: {
          event_type: "PAYMENT.CAPTURE.COMPLETED",
          resource: {
            invoice_id: "pyr_invoice_1",
            supplementary_data: { related_ids: { order_id: "ORDER-1" } },
          },
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: "paypal_webhook_signature_invalid",
        status: "FAIL_CLOSED",
      });
    } finally {
      await app.close();
    }
  });

  it("rejects signed PayPal webhooks without invoiceId/orderId", async () => {
    const secret = "test_webhook_secret";
    process.env["PAYPAL_WEBHOOK_SECRET"] = secret;
    const body = {
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {},
    };
    const app = await createPaymentApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/payments/paypal/webhook",
        headers: signPaypalBody(body, secret),
        payload: body,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: "invoiceId_required" });
    } finally {
      await app.close();
    }
  });

  it("rejects signed PayPal webhooks when invoiceId and orderId do not match a provider event", async () => {
    const secret = "test_webhook_secret";
    process.env["PAYPAL_WEBHOOK_SECRET"] = secret;
    vi.doMock("../server/vyrdx/domain/runtime-config.js", () => ({
      checkRuntimeConfig: () => ({
        scope: "payments",
        provider: "paypal",
        ready: true,
        decision: "CONFIG_READY",
        missingConfig: [],
        invalidConfig: [],
        reason: "PAYMENT_RUNTIME_CONFIG_READY",
        nextAction: "SET_ENV_VARS_AND_RERUN_SMOKE",
      }),
      runtimeConfigFailurePayload: () => ({
        error: "INCOMPLETE_RUNTIME_CONFIG",
        decision: "INCOMPLETE_RUNTIME_CONFIG",
        status: "FAIL_CLOSED",
        scope: "payments",
        missingConfig: [],
        invalidConfig: [],
        reason: "test",
        nextAction: "SET_ENV_VARS_AND_RERUN_SMOKE",
        monitorEvent: { id: "evt", evidenceStamp: "stamp", evidencePath: "path" },
      }),
    }));
    vi.doMock("../server/db.js", () => ({
      queryOne: vi.fn(async () => null),
      query: vi.fn(async () => []),
      getPool: vi.fn(),
    }));

    const body = {
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        invoice_id: "pyr_invoice_1",
        supplementary_data: { related_ids: { order_id: "ORDER-1" } },
      },
    };
    const app = await createPaymentApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/payments/paypal/webhook",
        headers: signPaypalBody(body, secret),
        payload: body,
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: "paypal_order_invoice_mismatch",
        status: "FAIL_CLOSED",
        invoiceId: "pyr_invoice_1",
        orderId: "ORDER-1",
      });
    } finally {
      await app.close();
    }
  });
});
