import { describe, expect, it } from "vitest";
import { assertRagNoDirectExec } from "../guards/policy.guard.js";

describe("rag policy guard", () => {
  it("rejects exec-prefixed actions", () => {
    expect(() =>
      assertRagNoDirectExec({
        requestId: "r1",
        module: "rag",
        action: "exec:runtime.call",
        payload: {},
        context: {
          sessionId: "s1",
          actorId: "a1",
          actorRole: "operator",
          room: "vxstation",
          terminalMode: "operator",
          correlationId: "c1",
          issuedAtUtc: new Date().toISOString()
        }
      })
    ).toThrow();
  });
});
