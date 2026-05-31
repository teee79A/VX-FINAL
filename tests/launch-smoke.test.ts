import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runLaunchSmoke } from "../scripts/launch/smoke.js";

describe("launch smoke script", () => {
  beforeEach(() => {
    const root = mkdtempSync(join(tmpdir(), "vyrdx-smoke-test-"));
    process.env["VYRDX_LAUNCH_EVENT_LOG"] = join(root, "events.jsonl");
    process.env["VYRDEN_FLYER_STATE_DIR"] = join(root, "flyer");
  });

  afterEach(() => {
    delete process.env["VYRDX_LAUNCH_EVENT_LOG"];
    delete process.env["VYRDEN_FLYER_STATE_DIR"];
  });

  it("proves gated intake, business motion, payment gate, room event, and evidence stamp", async () => {
    const result = await runLaunchSmoke({ requirePaymentSuccess: false });

    expect(result.ok).toBe(true);
    expect(result.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(result.steps.crm).toMatchObject({ gate: "ALLOWED", routeStatus: 503 });
    expect(result.steps.payment).toMatchObject({ gate: "ALLOWED" });
    expect(result.rooms.launchRevenue.counts["gate_evaluated"]).toBeGreaterThanOrEqual(2);
    expect(result.rooms.launchFeedback.counts["booked"]).toBe(1);
    expect(result.rooms.launchFeedback.evidenceLinks[0]?.evidenceStamp).toMatch(/^evd_launch_/);
  });
});
