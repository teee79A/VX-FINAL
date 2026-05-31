const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7800";

export type ContractRoom =
  | "camp"
  | "commercial"
  | "evidence"
  | "market"
  | "reports_plans"
  | "system"
  | "ops";

export interface RoomContractResponse {
  room: ContractRoom;
  title: string;
  summary: {
    status: "green" | "amber" | "red";
    recordClass: "Public" | "Private";
    evidenceRef: string | null;
    data: Record<string, unknown>;
    updatedAtUtc: string;
  };
  statusReasons: Array<{
    id: string;
    reason_code: string;
    reason_text: string;
    evidence_ref: string;
    next_action: string;
    next_update_eta: string;
    created_at: string;
  }>;
  changeEvents: Array<{
    id: string;
    event_type: string;
    event_payload: Record<string, unknown>;
    evidence_ref: string | null;
    actor: string | null;
    happened_at: string;
  }>;
  actions: Array<{
    id: string;
    action_name: string;
    action_payload: Record<string, unknown>;
    requested_by: string;
    status: string;
    evidence_ref: string | null;
    created_at: string;
    updated_at: string;
  }>;
  allowedActions: string[];
  gates: {
    nonGreenHasMandatoryReasonCompanions: boolean;
    evidenceBeforeGreen: boolean;
    stopConditions: Array<{
      code: string;
      scope: "read" | "write";
      source?: string;
    }>;
    hasReadBlockingConditions: boolean;
    hasWriteBlockingConditions: boolean;
  };
  stopConditions: {
    hasReadBlockingConditions: boolean;
    hasWriteBlockingConditions: boolean;
    conditions: Array<{
      code: string;
      scope: "read" | "write";
      source?: string;
    }>;
  };
  runtimeMode: "primary_db" | "degraded_read_only";
  isSynthesized: boolean;
  synthesized: boolean;
  generatedAtUtc: string;
}

export async function getRoomContract(room: string): Promise<RoomContractResponse | null> {
  try {
    const response = await fetch(`${API_URL}/api/room-contract/rooms/${encodeURIComponent(room)}`, {
      next: { revalidate: 10 },
    });
    if (!response.ok) return null;
    return response.json() as Promise<RoomContractResponse>;
  } catch {
    return null;
  }
}
