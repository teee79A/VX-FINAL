import { describe, expect, it } from "vitest";
import { ReportsModule } from "../reports.module.js";

describe("reports integration", () => {
  it("creates export request commands with bounded target", async () => {
    const mod = new ReportsModule();
    const request = {
      requestId: "r1",
      module: "reports",
      action: "export",
      payload: {
        op: "export_status" as const,
        format: "json" as const
      },
      context: {
        sessionId: "s1",
        actorId: "operator_1",
        actorRole: "operator",
        room: "vxstation" as const,
        terminalMode: "operator" as const,
        correlationId: "corr_1",
        issuedAtUtc: "2026-03-27T12:00:00Z"
      }
    };

    const result = await mod.process(request);
    const cmd = await mod.requestCommand(request);

    expect(result.ok).toBe(true);
    expect(cmd.ok).toBe(true);
    expect(cmd.data?.target).toBe("vxstation.reports");
  });
});
