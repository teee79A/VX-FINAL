export const STATE_SYNTHESIS_TARGETS = ["system", "state_synthesizer"] as const;

export function buildStateSynthesisInput(
  payload: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...payload,
    op: typeof payload.op === "string" ? payload.op : "topology",
  };
}
