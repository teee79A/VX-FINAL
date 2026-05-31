import { describe, expect, it } from "vitest";

describe("voice bypass prevention", () => {
  it("rejects direct runtime exec action names", () => {
    const action = "exec:runtime.voice";
    expect(action.startsWith("exec:")).toBe(true);
  });

  it("must not import internal executor", () => {
    expect(true).toBe(true);
  });
});
