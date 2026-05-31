import {
  CommandEnvelope,
  CommandReceipt,
  DecisionStatus,
  ReplayStatus
} from "./command.types.js";

export interface DecisionSnapshot {
  decision: DecisionStatus;
  decision_reason: string;
  policy_version: string;
  replay_status: ReplayStatus;
  payload_hash: string;
  command_id: string;
  idempotency_key: string;
  fingerprint: string;
  actor_id: string;
  route: CommandReceipt["route"];
}

const DEFAULT_POLICY_VERSION = process.env.KITTY_POLICY_VERSION || "kitty-policy-v1";

export function buildDecisionSnapshot(input: {
  command: CommandEnvelope;
  decision: DecisionStatus;
  decisionReason: string;
  replayStatus: ReplayStatus;
  route: CommandReceipt["route"];
}): DecisionSnapshot {
  return {
    decision: input.decision,
    decision_reason: input.decisionReason,
    policy_version: DEFAULT_POLICY_VERSION,
    replay_status: input.replayStatus,
    payload_hash: input.command.payload_hash,
    command_id: input.command.command_id,
    idempotency_key: input.command.idempotency_key,
    fingerprint: input.command.fingerprint,
    actor_id: input.command.actor_id,
    route: input.route
  };
}
