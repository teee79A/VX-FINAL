import { describe, expect, it } from "vitest";
import { assertMemoryNoDirectExec } from "../guards/policy.guard.js";

describe("memory policy guard", () => {
  it("rejects exec-prefixed actions", () => {
    expect(() =>
      assertMemoryNoDirectExec({
        requestId: "r1",
        module: "memory",
        action: "exec:runtime.mutate",
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
