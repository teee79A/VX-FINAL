import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerVyrdxBusinessMotionRoutes } from "../server/vyrdx/api/business-motions.js";
import { evaluateBusinessMotionGate } from "../server/vyrdx/domain/business-motion-gate.js";
import type { VyrdxBusinessMotion } from "../server/vyrdx/domain/business-gate.js";
import { makeIQ200Packet, makeQ201Packet } from "./helpers/vyrdx-business-packets.js";

describe("VYRDX business motion gate", () => {
  it.each([
    "crm_write",
    "outreach",
    "proposal",
    "deployment_routing",
  ] as VyrdxBusinessMotion[])("blocks %s when IQ200 is missing", (motion) => {
    const response = evaluateBusinessMotionGate({}, motion);

    expect(response.decision).toBe("BLOCKED");
    expect(response.status).toBe("BUSINESS_APPROACH_BLOCKED");
    expect(response.reason).toBe("Q201_BLOCKED_BY_IQ200");
    expect(response.missingFields).toContain("metadata");
    expect(response.standards.map((standard) => standard.id)).toContain("VYRDX-GATE-006");
    expect(response.boundaries).toContain("FAIL CLOSED ALWAYS");
    expect(response.nextAction).toContain("Submit missing Q201/IQ200 fields");
    expect(response.eventRef).toMatch(/^vyrdx:business-motion:/);
  });

  it("blocks business motions when IQ200 is below the pass threshold", () => {
    const iq200 = makeIQ200Packet(84);
    const q201 = makeQ201Packet(iq200, "CRM_READY");

    const response = evaluateBusinessMotionGate({ iq200Packet: iq200, businessAnswerPacket: q201 }, "crm_write");

    expect(response.decision).toBe("BLOCKED");
    expect(response.reason).toBe("Q201_BLOCKED_BY_IQ200");
    expect(response.iq200.state).toBe("IQ_SCORE_REVIEW");
  });

  it.each([
    ["crm_write", "Q201_READY", "CRM_GATE_STATE_NOT_READY"],
    ["proposal", "CRM_READY", "PROPOSAL_GATE_STATE_NOT_READY"],
    ["deployment_routing", "PAYMENT_READY", "DEPLOYMENT_GATE_STATE_NOT_READY"],
  ] as const)("blocks %s when Q201 state is %s", (motion, q201State, reason) => {
    const iq200 = makeIQ200Packet(90);
    const q201 = makeQ201Packet(iq200, q201State);

    const response = evaluateBusinessMotionGate({ iq200Packet: iq200, businessAnswerPacket: q201 }, motion);

    expect(response.decision).toBe("BLOCKED");
    expect(response.reason).toBe(reason);
    expect(response.missingFields).toContain("code/state.gateState");
  });

  it("blocks missing metadata and orchestrator fields", () => {
    const iq200 = makeIQ200Packet(90);
    const q201 = makeQ201Packet(iq200, "CRM_READY");
    q201.metadata.owner = "";
    (q201.orchestrator as { monitor: string }).monitor = "";

    const response = evaluateBusinessMotionGate({ iq200Packet: iq200, businessAnswerPacket: q201 }, "crm_write");

    expect(response.decision).toBe("BLOCKED");
    expect(response.reason).toBe("Q201_PACKET_INCOMPLETE");
    expect(response.missingFields).toContain("metadata.owner");
    expect(response.missingFields).toContain("orchestrator.monitor");
  });

  it.each([
    ["crm_write", "CRM_READY"],
    ["outreach", "Q201_READY"],
    ["proposal", "PROPOSAL_READY"],
    ["deployment_routing", "DEPLOYMENT_READY"],
  ] as const)("allows %s only after IQ200 pass and required Q201 state", (motion, q201State) => {
    const iq200 = makeIQ200Packet(90);
    const q201 = makeQ201Packet(iq200, q201State);

    const response = evaluateBusinessMotionGate({ iq200Packet: iq200, businessAnswerPacket: q201 }, motion);

    expect(response.decision).toBe("ALLOWED");
    expect(response.status).toBe("GATE_ALLOWED");
    expect(response.missingFields).toEqual([]);
    expect(response.auditStamp).toBe("Q201_APPROVED_FOR_BUSINESS_APPROACH");
  });
});

describe("VYRDX guarded business motion routes", () => {
  it("fails closed before CRM work when gate packets are missing", async () => {
    const app = Fastify();
    await registerVyrdxBusinessMotionRoutes(app);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/vyrdx/business/crm/upsert",
        payload: {},
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        error: "BUSINESS_APPROACH_BLOCKED",
        decision: "BLOCKED",
        motion: "crm_write",
        reason: "Q201_BLOCKED_BY_IQ200",
      });
    } finally {
      await app.close();
    }
  });

  it("does not claim success when gate passes but no real dispatcher is configured", async () => {
    const iq200 = makeIQ200Packet(90);
    const q201 = makeQ201Packet(iq200, "CRM_READY");
    const app = Fastify();
    await registerVyrdxBusinessMotionRoutes(app);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/vyrdx/business/crm/upsert",
        payload: {
          iq200Packet: iq200,
          businessAnswerPacket: q201,
        },
      });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        error: "INCOMPLETE_INTEGRATION_CONFIG",
        decision: "INCOMPLETE_INTEGRATION_CONFIG",
        reason: "CRM_DISPATCHER_CONFIG_MISSING",
        missingConfig: ["CRM_DISPATCHER_URL", "CRM_DISPATCHER_TOKEN"],
        nextAction: "SET_ENV_VARS_AND_RERUN_SMOKE",
      });
    } finally {
      await app.close();
    }
  });
});
