export const CROSS_ROOM_COORDINATION_TARGETS = [
  "ops",
  "ceo_dispatch",
  "ops_dispatch",
  "cross_room_coordinator",
  "master_brain_orchestrator",
] as const;

export function buildCrossRoomCoordinationInput(
  payload: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...payload,
    op: typeof payload.op === "string" ? payload.op : "dispatch",
  };
}
