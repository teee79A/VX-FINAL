import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerPaymentRoutes } from "../server/api/payments.js";
import { makeIQ200Packet, makeQ201Packet } from "./helpers/vyrdx-business-packets.js";

describe("payment business gate", () => {
  it("blocks payment requests before IQ200 and Q201 pass", async () => {
    const app = Fastify();
    await registerPaymentRoutes(app);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/payments/request",
        payload: {
          workspaceId: "ws_alpha",
          productCode: "solo",
          paymentMethod: "paypal",
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        error: "PAYMENT_REQUEST_BLOCKED",
        decision: "BLOCKED",
        status: "FAIL_CLOSED",
        reason: "Q201_BLOCKED_BY_IQ200",
        businessGate: {
          state: "BUSINESS_APPROACH_BLOCKED",
          lockId: "Q201 PRE-BUSINESS APPROVAL INTELLIGENCE GATE",
          qid: "Q201",
          stamp: "BUSINESS_APPROACH_BLOCKED_UNTIL_IQ_PASS",
        },
      });
      expect(response.json().missingFields).toContain("iq200Packet");
      expect(response.json().missingFields).toContain("businessAnswerPacket");
      expect(response.json().missingFields).toContain("offerCode");
    } finally {
      await app.close();
    }
  });

  it("requires a valid launch offer code after IQ200 and Q201 payment readiness", async () => {
    const iq200 = makeIQ200Packet(90);
    const q201 = makeQ201Packet(iq200, "PAYMENT_READY");
    const app = Fastify();
    await registerPaymentRoutes(app);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/payments/request",
        payload: {
          workspaceId: "ws_alpha",
          productCode: "business",
          offerCode: "BAD_OFFER",
          paymentMethod: "paypal",
          paymentMetadata: {
            pilotId: "pilot_alpha",
            channel: "email",
            assetVersion: "v1",
          },
          iq200Packet: iq200,
          businessAnswerPacket: q201,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        error: "PAYMENT_REQUEST_BLOCKED",
        decision: "BLOCKED",
        status: "FAIL_CLOSED",
        reason: "PAYMENT_OFFER_INVALID",
        invalidFields: ["offerCode"],
        validOfferCodes: ["IQ200_AUDIT", "VYRDX_REVENUE_PILOT", "VXSTATION_CONTROL_ROOM"],
      });
    } finally {
      await app.close();
    }
  });

  it("requires launch payment metadata before payment work starts", async () => {
    const iq200 = makeIQ200Packet(90);
    const q201 = makeQ201Packet(iq200, "PAYMENT_READY");
    const app = Fastify();
    await registerPaymentRoutes(app);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/payments/request",
        payload: {
          workspaceId: "ws_alpha",
          productCode: "business",
          offerCode: "VYRDX_REVENUE_PILOT",
          paymentMethod: "paypal",
          paymentMetadata: {
            pilotId: "pilot_alpha",
          },
          iq200Packet: iq200,
          businessAnswerPacket: q201,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        error: "PAYMENT_REQUEST_BLOCKED",
        decision: "BLOCKED",
        status: "FAIL_CLOSED",
        reason: "PAYMENT_METADATA_REQUIRED",
        missingFields: ["paymentMetadata.channel", "paymentMetadata.assetVersion"],
      });
    } finally {
      await app.close();
    }
  });

  it("blocks payment requests when Q201 is not payment or deployment ready", async () => {
    const iq200 = makeIQ200Packet(90);
    const q201 = makeQ201Packet(iq200, "CRM_READY");
    const app = Fastify();
    await registerPaymentRoutes(app);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/payments/request",
        payload: {
          workspaceId: "ws_alpha",
          productCode: "business",
          offerCode: "VYRDX_REVENUE_PILOT",
          paymentMethod: "paypal",
          paymentMetadata: {
            pilotId: "pilot_alpha",
            channel: "email",
            assetVersion: "v1",
          },
          iq200Packet: iq200,
          businessAnswerPacket: q201,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        error: "PAYMENT_REQUEST_BLOCKED",
        decision: "BLOCKED",
        status: "FAIL_CLOSED",
        reason: "PAYMENT_GATE_STATE_NOT_READY",
      });
      expect(response.json().missingFields).toContain("code/state.gateState");
    } finally {
      await app.close();
    }
  });

  it("fails closed with runtime config details before payment DB writes", async () => {
    const originalDatabaseUrl = process.env["DATABASE_URL"];
    process.env["VYRDX_LAUNCH_EVENT_LOG"] = join(mkdtempSync(join(tmpdir(), "vyrdx-payment-config-")), "events.jsonl");
    delete process.env["DATABASE_URL"];

    const iq200 = makeIQ200Packet(90);
    const q201 = makeQ201Packet(iq200, "PAYMENT_READY");
    const app = Fastify();
    await registerPaymentRoutes(app);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/payments/request",
        payload: {
          workspaceId: "ws_alpha",
          productCode: "business",
          offerCode: "VYRDX_REVENUE_PILOT",
          paymentMethod: "paypal",
          paymentMetadata: {
            pilotId: "pilot_alpha",
            channel: "email",
            assetVersion: "v1",
          },
          iq200Packet: iq200,
          businessAnswerPacket: q201,
        },
      });

      expect(response.statusCode).toBe(503);
      const payload = response.json();
      expect(payload).toMatchObject({
        error: "INCOMPLETE_RUNTIME_CONFIG",
        decision: "INCOMPLETE_RUNTIME_CONFIG",
        status: "FAIL_CLOSED",
        scope: "payments",
        nextAction: "SET_ENV_VARS_AND_RERUN_SMOKE",
      });
      expect(payload.missingConfig).toContain("DATABASE_URL");
    } finally {
      await app.close();
      if (originalDatabaseUrl === undefined) {
        delete process.env["DATABASE_URL"];
      } else {
        process.env["DATABASE_URL"] = originalDatabaseUrl;
      }
      delete process.env["VYRDX_LAUNCH_EVENT_LOG"];
    }
  });
});
