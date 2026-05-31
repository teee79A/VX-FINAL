import { CommandBackbone } from "./command.backbone.js";
import { IdempotencyGuard } from "./idempotency.guard.js";
import { sha256 } from "./command.security.js";
import { CommandEnvelope, ReplayStatus } from "./command.types.js";

export type ReplayGuardResult =
  | { ok: true; status: "PASSED" }
  | {
      ok: false;
      status: Exclude<ReplayStatus, "PASSED">;
      reason: string;
    };

export class ReplayGuard {
  constructor(
    private readonly backbone: CommandBackbone,
    private readonly idempotencyGuard: IdempotencyGuard
  ) {}

  async validate(command: CommandEnvelope): Promise<ReplayGuardResult> {
    await this.backbone.purgeExpiredNonces();

    const nonce = await this.backbone.findNonce(command.nonce);
    if (nonce) {
      return {
        ok: false,
        status: "NONCE_REUSED",
        reason: "Nonce was already used."
      };
    }

    const now = Date.now();
    if (Math.abs(now - command.issued_at) > command.replay_window_ms) {
      return {
        ok: false,
        status: "TIME_WINDOW_EXCEEDED",
        reason: "Issued timestamp is outside the allowed replay window."
      };
    }

    const idempotency = await this.idempotencyGuard.validate(command);
    if (!idempotency.ok) {
      return idempotency;
    }

    const causal = await this.validateCausalChain(command);
    if (!causal.ok) {
      return causal;
    }

    return {
      ok: true,
      status: "PASSED"
    };
  }

  private async validateCausalChain(
    command: CommandEnvelope
  ): Promise<
    | { ok: true }
    | {
        ok: false;
        status: "CAUSAL_CHAIN_MISMATCH";
        reason: string;
      }
  > {
    if (command.parent_command_id) {
      const parent = await this.backbone.findCommandById(command.parent_command_id);
      if (!parent) {
        return {
          ok: false,
          status: "CAUSAL_CHAIN_MISMATCH",
          reason: "Parent command does not exist."
        };
      }

      const expected = sha256(`${parent.causal_hash}:${command.payload_hash}`);
      if (command.causal_hash !== expected) {
        return {
          ok: false,
          status: "CAUSAL_CHAIN_MISMATCH",
          reason: "Causal hash does not match parent chain."
        };
      }
      return { ok: true };
    }

    const expectedRoot = sha256(`root:${command.payload_hash}`);
    if (command.causal_hash !== expectedRoot) {
      return {
        ok: false,
        status: "CAUSAL_CHAIN_MISMATCH",
        reason: "Root causal hash is invalid."
      };
    }
    return { ok: true };
  }
}
