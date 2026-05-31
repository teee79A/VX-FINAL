import { describe, expect, it } from "vitest";
import { CalendarModule } from "../calendar.module.js";

describe("calendar module contract", () => {
  it("exposes calendar manifest", async () => {
    const mod = new CalendarModule();
    expect(mod.manifest.name).toBe("calendar");
  });
});
