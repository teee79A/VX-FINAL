import { describe, expect, it } from "vitest";
import { resolveConfirmedEntitlement } from "../server/lib/entitlements.js";

describe("resolveConfirmedEntitlement", () => {
  it("adds one seal on top of the free allowance when a fresh workspace buys a one-time seal", () => {
    expect(
      resolveConfirmedEntitlement({
        currentPlan: "free",
        existingIncludedSeals: null,
        productCode: "seal",
      }),
    ).toEqual({
      nextPlan: "free",
      includedSeals: 6,
      resetUsedSeals: false,
    });
  });

  it("increments the current allowance for one-time seal purchases when a usage period already exists", () => {
    expect(
      resolveConfirmedEntitlement({
        currentPlan: "free",
        existingIncludedSeals: 5,
        productCode: "seal",
      }),
    ).toEqual({
      nextPlan: "free",
      includedSeals: 6,
      resetUsedSeals: false,
    });
  });

  it("resets the allowance to the paid plan quota on solo activation", () => {
    expect(
      resolveConfirmedEntitlement({
        currentPlan: "free",
        existingIncludedSeals: 5,
        productCode: "solo",
      }),
    ).toEqual({
      nextPlan: "solo",
      includedSeals: 200,
      resetUsedSeals: true,
    });
  });

  it("uses the paid plan allowance when there is no current usage period yet", () => {
    expect(
      resolveConfirmedEntitlement({
        currentPlan: "free",
        existingIncludedSeals: null,
        productCode: "business",
      }),
    ).toEqual({
      nextPlan: "business",
      includedSeals: 1000,
      resetUsedSeals: true,
    });
  });
});
