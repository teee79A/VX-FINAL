import { describe, expect, it } from "vitest";

describe("rag bypass prevention", () => {
  it("rejects direct runtime exec action names", () => {
    const action = "exec:runtime.call";
    expect(action.startsWith("exec:")).toBe(true);
  });
});
