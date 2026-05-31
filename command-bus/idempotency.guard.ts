import { CommandBackbone } from "./command.backbone.js";
import { CommandEnvelope, ReplayStatus } from "./command.types.js";

export type IdempotencyGuardResult =
  | { ok: true }
  | {
      ok: false;
      status: Extract<ReplayStatus, "IDEMPOTENCY_CONFLICT" | "FINGERPRINT_DUPLICATE">;
      reason: string;
    };

export class IdempotencyGuard {
  constructor(private readonly backbone: CommandBackbone) {}

  async validate(command: CommandEnvelope): Promise<IdempotencyGuardResult> {
    const existingByKey = await this.backbone.findCommandByIdempotencyKey(
      command.idempotency_key
    );
    if (existingByKey && existingByKey.payload_hash !== command.payload_hash) {
      return {
        ok: false,
        status: "IDEMPOTENCY_CONFLICT",
        reason: "Idempotency key was already finalized with a different payload hash."
      };
    }

    const fingerprintExists = await this.backbone.existsFingerprint(
      command.fingerprint
    );
    if (fingerprintExists) {
      return {
        ok: false,
        status: "FINGERPRINT_DUPLICATE",
        reason: "Fingerprint already finalized."
      };
    }

    return { ok: true };
  }
}
