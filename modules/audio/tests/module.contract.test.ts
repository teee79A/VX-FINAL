import { describe, expect, it } from "vitest";
import { AudioModule } from "../audio.module.js";

describe("audio module contract", () => {
  it("exposes audio manifest", () => {
    const mod = new AudioModule();
    expect(mod.manifest.name).toBe("audio");
  });
});
