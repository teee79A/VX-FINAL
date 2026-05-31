import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerVyrdxLaunchMonitorRoutes } from "../server/vyrdx/api/launch-monitor.js";
import { getLaunchRoomState, resetLaunchEventsForTest } from "../server/vyrdx/domain/launch-events.js";
import { checkRuntimeConfig } from "../server/vyrdx/domain/runtime-config.js";

describe("runtime config health", () => {
  const originalCrmUrl = process.env["CRM_DISPATCHER_URL"];
  const originalCrmToken = process.env["CRM_DISPATCHER_TOKEN"];

  beforeEach(() => {
    process.env["VYRDX_LAUNCH_EVENT_LOG"] = join(mkdtempSync(join(tmpdir(), "vyrdx-runtime-config-")), "events.jsonl");
    delete process.env["CRM_DISPATCHER_URL"];
    delete process.env["CRM_DISPATCHER_TOKEN"];
    resetLaunchEventsForTest();
  });

  afterEach(() => {
    resetLaunchEventsForTest();
    restoreEnv("CRM_DISPATCHER_URL", originalCrmUrl);
    restoreEnv("CRM_DISPATCHER_TOKEN", originalCrmToken);
    delete process.env["VYRDX_LAUNCH_EVENT_LOG"];
  });

  it("reports CRM dispatcher config as incomplete without secrets", () => {
    const check = checkRuntimeConfig("crm");

    expect(check.ready).toBe(false);
    expect(check.decision).toBe("INCOMPLETE_INTEGRATION_CONFIG");
    expect(check.missingConfig).toEqual(["CRM_DISPATCHER_URL", "CRM_DISPATCHER_TOKEN"]);
    expect(JSON.stringify(check)).not.toContain("secret");
  });

  it("emits config_missing events into launch monitor rooms", async () => {
    const app = Fastify();
    await registerVyrdxLaunchMonitorRoutes(app);

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/vyrdx/launch/runtime-config",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        ok: false,
      });
      const runtime = getLaunchRoomState("launch-runtime");
      const revenue = getLaunchRoomState("launch-revenue");
      expect(runtime.counts["config_missing"]).toBeGreaterThanOrEqual(1);
      expect(runtime.evidenceLinks[0]?.evidenceStamp).toMatch(/^evd_launch_/);
      expect(revenue.counts["config_missing"]).toBeGreaterThanOrEqual(1);
      expect(revenue.evidenceLinks[0]?.evidenceStamp).toMatch(/^evd_launch_/);
    } finally {
      await app.close();
    }
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
