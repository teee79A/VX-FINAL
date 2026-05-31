export const ORCHESTRATION_LOGIC_TARGETS = [
  "trust_closure",
  "seal_readiness",
  "commercial",
  "commercial_dispatch",
  "market",
  "evidence",
  "archive_dispatch",
  "campaign",
  "claude_code_logic_brain",
] as const;

export function buildOrchestrationLogicInput(
  target: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const defaultOps: Record<string, string> = {
    trust_closure: "audit-edges",
    seal_readiness: "check",
    commercial: "status",
    commercial_dispatch: "status",
    market: "scan",
    evidence: "audit",
    archive_dispatch: "archive",
    campaign: "status",
    claude_code_logic_brain: "respond",
  };

  return {
    ...payload,
    op:
      typeof payload.op === "string"
        ? payload.op
        : (defaultOps[target] ?? "status"),
  };
}
