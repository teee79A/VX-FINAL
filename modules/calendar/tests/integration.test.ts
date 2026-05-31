import { describe, expect, it } from "vitest";
import { CalendarModule } from "../calendar.module.js";

describe("calendar integration", () => {
  it("returns proposal and command request for propose_schedule", async () => {
    const mod = new CalendarModule();
    const request = {
      requestId: "r1",
      module: "calendar",
      action: "propose",
      payload: {
        op: "propose_schedule" as const,
        atUtc: "2026-03-27T13:00:00Z",
        title: "Ops Standup"
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
    expect(cmd.data?.type).toBe("calendar.state.upsert");
    expect(cmd.data?.target).toBe("vxstation.bridge.calendar");
    expect(cmd.data?.required_capabilities).toEqual(["calendar.state"]);
  });
});
