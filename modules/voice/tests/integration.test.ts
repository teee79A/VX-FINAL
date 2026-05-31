import { describe, expect, it } from "vitest";
import { VoiceModule } from "../voice.module.js";

describe("voice integration", () => {
  it("creates synthesis command requests without direct execution", async () => {
    const mod = new VoiceModule();
    const request = {
      requestId: "r1",
      module: "voice",
      action: "synthesize",
      payload: {
        op: "synthesize" as const,
        text: "hello from kitty voice lane",
        voiceProfile: "operator-default"
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
    expect(cmd.data?.target).toBe("vyrdx.boundary.request");
  });
});
