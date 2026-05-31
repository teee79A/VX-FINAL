import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerVyrdxBusinessMotionRoutes } from "../server/vyrdx/api/business-motions.js";
import { registerVyrdxLaunchMonitorRoutes } from "../server/vyrdx/api/launch-monitor.js";
import {
  getLaunchRoomState,
  recordLaunchEvent,
  renderLaunchRoomHtml,
  resetLaunchEventsForTest,
} from "../server/vyrdx/domain/launch-events.js";
import { makeIQ200Packet, makeQ201Packet } from "./helpers/vyrdx-business-packets.js";

describe("VYRDX launch monitor rooms", () => {
  beforeEach(() => {
    process.env["VYRDX_LAUNCH_EVENT_LOG"] = join(mkdtempSync(join(tmpdir(), "vyrdx-launch-")), "events.jsonl");
    resetLaunchEventsForTest();
  });

  afterEach(() => {
    resetLaunchEventsForTest();
    delete process.env["VYRDX_LAUNCH_EVENT_LOG"];
  });

  it("writes typed events with evidence stamps and ingests them into launch-feedback", () => {
    const event = recordLaunchEvent({
      type: "feedback_received",
      source: "manual-feedback-entry",
      status: "received",
      reason: "pilot_reply_logged",
      payload: {
        pilotId: "pilot_alpha",
        sentiment: "interested",
      },
    });

    const room = getLaunchRoomState("launch-feedback");

    expect(event.evidenceStamp).toMatch(/^evd_launch_/);
    expect(room.counts["feedback_received"]).toBe(1);
    expect(room.lastEvents[0]?.id).toBe(event.id);
    expect(room.evidenceLinks[0]?.evidenceStamp).toBe(event.evidenceStamp);
  });

  it("renders launch rooms with counts, last events, failures, blocked reasons, and evidence links", () => {
    recordLaunchEvent({
      type: "deploy_failed",
      room: "launch-runtime",
      source: "deployment-router",
      status: "failed",
      reason: "canary_failed",
      payload: { deploymentId: "deploy_alpha" },
    });

    const html = renderLaunchRoomHtml("launch-runtime");

    expect(html).toContain("Launch Runtime");
    expect(html).toContain("Counts");
    expect(html).toContain("Last Events");
    expect(html).toContain("Failure Queue");
    expect(html).toContain("Blocked Reasons");
    expect(html).toContain("Evidence Links");
    expect(html).toContain("canary_failed");
    expect(html).toContain("evd_launch_");
  });

  it("exposes JSON rooms and typed event ingestion routes", async () => {
    const app = Fastify();
    await registerVyrdxLaunchMonitorRoutes(app);

    try {
      const create = await app.inject({
        method: "POST",
        url: "/api/vyrdx/launch/events",
        payload: {
          type: "reply",
          source: "pilot-inbox",
          status: "received",
          payload: { pilotId: "pilot_beta" },
        },
      });
      expect(create.statusCode).toBe(201);

      const room = await app.inject({
        method: "GET",
        url: "/api/vyrdx/launch/rooms/launch-feedback",
      });

      expect(room.statusCode).toBe(200);
      expect(room.json()).toMatchObject({
        room: "launch-feedback",
        counts: { reply: 1 },
      });
    } finally {
      await app.close();
    }
  });

  it("business-motion gate events reach the launch-revenue monitor room", async () => {
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
      const body = response.json() as { monitorEvent?: { evidenceStamp?: string } };
      expect(body.monitorEvent?.evidenceStamp).toMatch(/^evd_launch_/);

      const room = getLaunchRoomState("launch-revenue");
      expect(room.counts["gate_evaluated"]).toBe(1);
      expect(room.counts["config_missing"]).toBe(1);
      expect(room.lastEvents.find((event) => event.type === "gate_evaluated")?.status).toBe("allowed");
    } finally {
      await app.close();
    }
  });
});
