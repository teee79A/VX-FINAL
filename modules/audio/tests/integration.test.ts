import { describe, expect, it } from "vitest";
import { AudioModule } from "../audio.module.js";

describe("audio integration", () => {
  it("creates transcribe command requests without direct execution", async () => {
    const mod = new AudioModule();
    const request = {
      requestId: "r1",
      module: "audio",
      action: "transcribe",
      payload: {
        op: "transcribe_chunk" as const,
        roomId: "room-1",
        chunkId: "chunk-1"
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
