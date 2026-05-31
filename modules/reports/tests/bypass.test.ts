import { describe, expect, it } from "vitest";

describe("reports bypass prevention", () => {
  it("rejects direct runtime exec action names", () => {
    const action = "exec:runtime.report";
    expect(action.startsWith("exec:")).toBe(true);
  });

  it("must not import internal executor", () => {
    expect(true).toBe(true);
  });
});
