import { describe, expect, it } from "vitest";
import { ReportsModule } from "../reports.module.js";

describe("reports module contract", () => {
  it("exposes reports manifest", () => {
    const mod = new ReportsModule();
    expect(mod.manifest.name).toBe("reports");
  });
});
