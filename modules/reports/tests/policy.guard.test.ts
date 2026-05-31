import { describe, expect, it } from "vitest";
import { assertReportsNoDirectExec } from "../guards/policy.guard.js";

describe("reports policy guard", () => {
  it("rejects exec-prefixed actions", () => {
    expect(() =>
      assertReportsNoDirectExec({
        requestId: "r1",
        module: "reports",
        action: "exec:runtime.report",
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
