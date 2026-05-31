import { describe, expect, it } from "vitest";
import { ModuleRegistry } from "../registry/module.registry.js";
import { CalendarModule } from "../modules/calendar/calendar.module.js";

describe("module registry", () => {
  it("registers and resolves module by name", () => {
    const registry = new ModuleRegistry();
    registry.register("calendar", new CalendarModule());
    expect(registry.list()).toContain("calendar");
    expect(registry.get("calendar").manifest.name).toBe("calendar");
  });

  it("blocks duplicate registration", () => {
    const registry = new ModuleRegistry();
    registry.register("calendar", new CalendarModule());
    expect(() => registry.register("calendar", new CalendarModule())).toThrow(
      "MODULE_ALREADY_REGISTERED:calendar"
    );
  });

  it("fails closed on missing module", () => {
    const registry = new ModuleRegistry();
    expect(() => registry.get("unknown")).toThrow("MODULE_NOT_FOUND:unknown");
  });
});
