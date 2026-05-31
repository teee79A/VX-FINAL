import { describe, expect, it } from "vitest";
import { assertVoiceNoDirectExec } from "../guards/policy.guard.js";

describe("voice policy guard", () => {
  it("rejects exec-prefixed actions", () => {
    expect(() =>
      assertVoiceNoDirectExec({
        requestId: "r1",
        module: "voice",
        action: "exec:runtime.voice",
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
