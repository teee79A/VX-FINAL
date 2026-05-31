import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ingestFlyerFeedback,
  parsePilotList,
  resetFlyerBotStateForTest,
  sendFlyer,
  type FlyerPilotContact,
} from "../vyrden-airoom/src/bots/flyer-distribution.js";
import { registerFlyerBotRoutes } from "../vyrden-airoom/src/routes/flyer-bot.js";
import { getLaunchRoomState, resetLaunchEventsForTest } from "../server/vyrdx/domain/launch-events.js";

describe("VYRDEN flyer distribution bot", () => {
  beforeEach(() => {
    const root = mkdtempSync(join(tmpdir(), "vyrden-flyer-"));
    process.env["VYRDEN_FLYER_STATE_DIR"] = join(root, "flyer");
    process.env["VYRDX_LAUNCH_EVENT_LOG"] = join(root, "launch", "events.jsonl");
    resetFlyerBotStateForTest();
    resetLaunchEventsForTest();
  });

  afterEach(() => {
    resetFlyerBotStateForTest();
    resetLaunchEventsForTest();
    delete process.env["VYRDEN_FLYER_STATE_DIR"];
    delete process.env["VYRDX_LAUNCH_EVENT_LOG"];
  });

  it("parses pilot lists from JSON and CSV", () => {
    const json = parsePilotList(JSON.stringify([pilot()]), "json");
    const csv = parsePilotList(
      "pilotId,channel,contact,segment,assetVersion,allowed\npilot_csv,email,csv@example.com,agency,v1,true",
      "csv",
    );

    expect(json[0]?.pilotId).toBe("pilot_alpha");
    expect(csv[0]).toMatchObject({
      pilotId: "pilot_csv",
      channel: "email",
      allowed: true,
    });
  });

  it.each([
    ["pilotId"],
    ["assetVersion"],
    ["channel"],
    ["allowed"],
  ] as const)("cannot send without %s", (field) => {
    const input = pilot() as Partial<FlyerPilotContact>;
    if (field === "allowed") input.allowed = false;
    else delete input[field];

    const result = sendFlyer(input as FlyerPilotContact);

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.missingFields).toContain(field);
    expect(result.evidenceStamp).toBeNull();
  });

  it("cannot send when hourly throttle is exceeded", () => {
    const now = new Date("2026-05-07T00:00:00.000Z");
    const first = sendFlyer(pilot({ contact: "a@example.com" }), { hourlyLimit: 1, now });
    const second = sendFlyer(pilot({ pilotId: "pilot_beta", contact: "b@example.com" }), { hourlyLimit: 1, now });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe("FLYER_HOURLY_THROTTLE_EXCEEDED");
  });

  it("dedupes repeat sends and respects opt-out feedback", () => {
    const first = sendFlyer(pilot());
    const duplicate = sendFlyer(pilot());
    const feedback = ingestFlyerFeedback({
      pilotId: "pilot_alpha",
      channel: "email",
      contact: "lead@example.com",
      message: "STOP please",
    });
    const afterOptOut = sendFlyer(pilot({ pilotId: "pilot_next", assetVersion: "v2" }));

    expect(first.ok).toBe(true);
    expect(duplicate.reason).toBe("FLYER_DUPLICATE_SEND_BLOCKED");
    expect(feedback.optOutRecorded).toBe(true);
    expect(afterOptOut.reason).toBe("FLYER_OPT_OUT_ACTIVE");
  });

  it("writes evidence for every send and routes feedback into launch-feedback", () => {
    const result = sendFlyer(pilot());
    const stateDir = process.env["VYRDEN_FLYER_STATE_DIR"] ?? "";
    const outbox = readFileSync(join(stateDir, "email-outbox.jsonl"), "utf-8");

    expect(result.ok).toBe(true);
    expect(result.evidenceStamp).toMatch(/^evd_flyer_/);
    expect(outbox).toContain(result.evidenceStamp ?? "");

    const feedback = ingestFlyerFeedback({
      pilotId: "pilot_alpha",
      channel: "email",
      contact: "lead@example.com",
      message: "Can we book a call?",
    });
    const room = getLaunchRoomState("launch-feedback");

    expect(feedback.type).toBe("booked");
    expect(feedback.evidenceStamp).toMatch(/^evd_launch_/);
    expect(room.counts["booked"]).toBe(1);
  });

  it("exposes guarded send and feedback endpoints", async () => {
    const app = Fastify();
    await registerFlyerBotRoutes(app);

    try {
      const blocked = await app.inject({
        method: "POST",
        url: "/api/flyer-bot/send",
        payload: { channel: "email", contact: "lead@example.com" },
      });
      expect(blocked.statusCode).toBe(403);

      const sent = await app.inject({
        method: "POST",
        url: "/api/flyer-bot/send",
        payload: pilot(),
      });
      expect(sent.statusCode).toBe(202);
      expect(sent.json()).toMatchObject({
        ok: true,
        status: "sent",
        reason: "FLYER_SEND_EVIDENCE_WRITTEN",
      });

      const feedback = await app.inject({
        method: "POST",
        url: "/api/flyer-bot/feedback",
        payload: {
          pilotId: "pilot_alpha",
          channel: "email",
          contact: "lead@example.com",
          message: "replying with interest",
        },
      });
      expect(feedback.statusCode).toBe(201);
      expect(feedback.json()).toMatchObject({ ok: true, type: "reply" });
    } finally {
      await app.close();
    }
  });
});

function pilot(overrides: Partial<FlyerPilotContact> = {}): FlyerPilotContact {
  return {
    pilotId: "pilot_alpha",
    channel: "email",
    contact: "lead@example.com",
    segment: "digital_marketing_agency",
    assetVersion: "v1",
    allowed: true,
    ...overrides,
  };
}
