export const PLAN_LIMITS = {
  free: 5,
  solo: 200,
  business: 1000,
  enterprise: 5000,
} as const;

type WorkspacePlan = keyof typeof PLAN_LIMITS;
type ProductCode = "seal" | "solo" | "business" | "enterprise";

export function getPlanLimit(plan: string): number {
  return PLAN_LIMITS[(plan as WorkspacePlan) ?? "free"] ?? PLAN_LIMITS.free;
}

export function getCurrentBillingPeriodBounds(now = new Date()): {
  periodStart: Date;
  periodEnd: Date;
} {
  return {
    periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
    periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
}

export function resolveConfirmedEntitlement(input: {
  currentPlan: string;
  existingIncludedSeals: number | null;
  productCode: ProductCode;
}): {
  nextPlan: string;
  includedSeals: number;
  resetUsedSeals: boolean;
} {
  if (input.productCode === "seal") {
    return {
      nextPlan: input.currentPlan,
      includedSeals: (input.existingIncludedSeals ?? getPlanLimit(input.currentPlan)) + 1,
      resetUsedSeals: false,
    };
  }

  return {
    nextPlan: input.productCode,
    includedSeals: getPlanLimit(input.productCode),
    resetUsedSeals: true,
  };
}
