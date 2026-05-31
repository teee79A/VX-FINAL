import { describe, expect, it } from "vitest";
import { RagModule } from "../rag.module.js";

describe("rag integration", () => {
  it("builds a boundary request for ask operation", async () => {
    const mod = new RagModule();
    const request = {
      requestId: "r1",
      module: "rag",
      action: "ask",
      payload: {
        op: "ask" as const,
        query: "what is lane status?"
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
    expect(cmd.data?.target).toBe("vxstation.brain.infer");
  });
});
