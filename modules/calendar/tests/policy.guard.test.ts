import { describe, expect, it } from "vitest";
import { assertNoDirectExec } from "../guards/policy.guard.js";

describe("calendar policy guard", () => {
  it("rejects exec-prefixed actions", () => {
    expect(() =>
      assertNoDirectExec({
        requestId: "r1",
        module: "calendar",
        action: "exec:runtime.transfer",
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
