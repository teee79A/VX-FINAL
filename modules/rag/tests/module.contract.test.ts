import { describe, expect, it } from "vitest";
import { RagModule } from "../rag.module.js";

describe("rag module contract", () => {
  it("exposes rag manifest", () => {
    const mod = new RagModule();
    expect(mod.manifest.name).toBe("rag");
  });
});
