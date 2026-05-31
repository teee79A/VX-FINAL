import { describe, expect, it } from "vitest";
import { MemoryModule } from "../memory.module.js";

describe("memory module contract", () => {
  it("exposes memory manifest", () => {
    const mod = new MemoryModule();
    expect(mod.manifest.name).toBe("memory");
  });
});
