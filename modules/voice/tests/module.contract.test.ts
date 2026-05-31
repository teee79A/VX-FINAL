import { describe, expect, it } from "vitest";
import { VoiceModule } from "../voice.module.js";

describe("voice module contract", () => {
  it("exposes voice manifest", () => {
    const mod = new VoiceModule();
    expect(mod.manifest.name).toBe("voice");
  });
});
