import { describe, expect, it } from "vitest";
import { assertAudioNoDirectExec } from "../guards/policy.guard.js";

describe("audio policy guard", () => {
  it("rejects exec-prefixed actions", () => {
    expect(() =>
      assertAudioNoDirectExec({
        requestId: "r1",
        module: "audio",
        action: "exec:runtime.audio",
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
