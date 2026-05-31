import { describe, expect, it } from "vitest";
import { MemoryModule } from "../memory.module.js";

describe("memory integration", () => {
  it("appends and then recalls session memory", async () => {
    const mod = new MemoryModule();
    const context = {
      sessionId: "s1",
      actorId: "operator_1",
      actorRole: "operator",
      room: "vxstation" as const,
      terminalMode: "operator" as const,
      correlationId: "corr_1",
      issuedAtUtc: "2026-03-27T12:00:00Z"
    };

    await mod.process({
      requestId: "r1",
      module: "memory",
      action: "append",
      payload: {
        op: "append" as const,
        sessionId: "s1",
        item: "hello"
      },
      context
    });

    const recalled = await mod.process({
      requestId: "r2",
      module: "memory",
      action: "recall",
      payload: {
        op: "recall" as const,
        sessionId: "s1"
      },
      context
    });

    expect(recalled.ok).toBe(true);
    if (recalled.ok && recalled.data && "items" in recalled.data) {
      expect(recalled.data.items).toContain("hello");
    }
  });
});
