export const DECISION_SUPPORT_TARGETS = [
  "feedback_ai",
  "feedback_dispatch",
  "decision_support",
  "infer",
] as const;

export function buildDecisionSupportInput(
  payload: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...payload,
    op: typeof payload.op === "string" ? payload.op : "respond",
  };
}
