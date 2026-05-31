export type ReplayStatus =
  | "PASSED"
  | "NONCE_REUSED"
  | "TIME_WINDOW_EXCEEDED"
  | "IDEMPOTENCY_CONFLICT"
  | "FINGERPRINT_DUPLICATE"
  | "CAUSAL_CHAIN_MISMATCH";

export type DecisionStatus = "ACCEPTED" | "REJECTED";
export type BrainProvider = "ceo_local" | "vllm" | "openrouter";

export interface SafeCommand {
  type: string;
  source: "terminal-shell" | "operator" | "policy" | `module:${string}`;
  target: string;
  payload: Record<string, unknown>;
  reason: string;
  required_capabilities?: string[];
  preferred_node_id?: string;
  command_id?: string;
  idempotency_key?: string;
  nonce?: string;
  issued_at?: number;
  parent_command_id?: string;
  causal_hash?: string;
}

export interface CommandReceipt {
  accepted: boolean;
  route:
    | "vxstation_local"
    | "vyrdx_boundary_request"
    | "brain_gateway"
    | "hyper_bridge_dispatch"
    | "denied";
  routedAtUtc: string;
  provider?: BrainProvider;
  outputPreview?: string;
  externalRequestId?: string;
  bridge_node_id?: string;
  bridge_endpoint?: string;
  dispatch_ref?: string;
  dispatch_status?: "accepted";
  dispatch_message?: string;
  evidenceRef?: string;
  command_id?: string;
  idempotency_key?: string;
  fingerprint?: string;
  decision_status?: DecisionStatus;
  replay_status?: ReplayStatus;
  decision_reason?: string;
}

export interface CommandEnvelope {
  command_id: string;
  idempotency_key: string;
  nonce: string;
  actor_id: string;
  issued_at: number;
  payload_hash: string;
  causal_hash: string;
  parent_command_id?: string;
  intent: string;
  payload: Record<string, unknown>;
  fingerprint: string;
  replay_window_ms: number;
  evidence_id: string;
}
