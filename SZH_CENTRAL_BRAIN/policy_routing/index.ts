export const POLICY_ROUTING_TARGETS = ["policy", "policy_router"] as const;

export function buildPolicyRoutingInput(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const op =
    typeof payload.op === "string"
      ? payload.op
      : payload.command
        ? "evaluate"
        : "audit";

  return {
    ...payload,
    op,
  };
}
