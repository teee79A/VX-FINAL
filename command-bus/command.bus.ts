import { ResultEnvelope } from "../shared/result.types.js";
import { makeRequestId } from "../shared/ids.js";
import { BrainGateway } from "./brain.gateway.js";
import { CommandDispatcher } from "./command.dispatcher.js";
import { BrainProvider, CommandEnvelope, CommandReceipt, SafeCommand } from "./command.types.js";
import { ValidationLayer } from "./validation.layer.js";
import { CommandBackbone } from "./command.backbone.js";
import {
  buildFingerprint,
  generateCommandId,
  generateNonce,
  sha256,
  stableStringify,
} from "./command.security.js";
import { IdempotencyGuard } from "./idempotency.guard.js";
import { ReplayGuard } from "./replay.guard.js";
import { buildDecisionSnapshot } from "./decision.snapshot.js";

interface CommandBusDeps {
  validationLayer?: ValidationLayer;
  dispatcher?: CommandDispatcher;
  brainGateway?: BrainGateway;
  backbone?: CommandBackbone;
  replayGuard?: ReplayGuard;
  evidenceLayer?: EvidenceLayer;
  replayWindowMs?: number;
}

export class CommandBus {
  private readonly validationLayer: ValidationLayer;
  private readonly dispatcher: CommandDispatcher;
  private readonly brainGateway: BrainGateway;
  private readonly backbone: CommandBackbone;
  private readonly replayGuard: ReplayGuard;
  private readonly evidenceLayer: EvidenceLayer;
  private readonly replayWindowMs: number;

  constructor(deps: CommandBusDeps = {}) {
    this.validationLayer = deps.validationLayer ?? new ValidationLayer();
    this.dispatcher = deps.dispatcher ?? new CommandDispatcher();
    this.brainGateway = deps.brainGateway ?? new BrainGateway();
    this.backbone = deps.backbone ?? new CommandBackbone();
    this.replayGuard =
      deps.replayGuard ?? new ReplayGuard(this.backbone, new IdempotencyGuard(this.backbone));
    // this.evidenceLayer = deps.evidenceLayer ?? new EvidenceLayer (VYRDX removed)(this.backbone);
    this.replayWindowMs = deps.replayWindowMs ?? 5 * 60 * 1000;
  }

  async submit(command: SafeCommand): Promise<
    ResultEnvelope<{
      accepted: boolean;
      route?: string;
      provider?: BrainProvider;
      outputPreview?: string;
      externalRequestId?: string;
      bridgeNodeId?: string;
      bridgeEndpoint?: string;
      dispatchRef?: string;
      dispatchStatus?: "accepted";
      dispatchMessage?: string;
      evidenceRef?: string;
    }>
  > {
    const requestId = makeRequestId("cmd");
    const startedAtUtc = new Date().toISOString();
    const envelope = this.toEnvelope(command);
    await this.normalizeCausalHash(envelope);

    try {
      this.validationLayer.assert(command);

      const replay = await this.replayGuard.validate(envelope);
      if (!replay.ok) {
        const receipt = await this.rejectWithEvidence({
          command,
          envelope,
          reason: replay.reason,
          replayStatus: replay.status,
        });
        return this.buildRejectionResult({
          requestId,
          startedAtUtc,
          receipt,
          errorMessage: replay.reason,
        });
      }

      const routed = await this.dispatcher.dispatch(command);
      const receipt: CommandReceipt = {
        ...routed,
        command_id: envelope.command_id,
        idempotency_key: envelope.idempotency_key,
        fingerprint: envelope.fingerprint,
        replay_status: "PASSED",
        decision_status: routed.accepted ? "ACCEPTED" : "REJECTED",
        decision_reason: routed.accepted ? "ROUTE_ACCEPTED" : "ROUTE_DENIED",
      };

      if (!routed.accepted || routed.route === "denied") {
        const denied = await this.rejectWithEvidence({
          command,
          envelope,
          reason: receipt.decision_reason || "ROUTE_DENIED",
          replayStatus: "PASSED",
        });
        return this.buildRejectionResult({
          requestId,
          startedAtUtc,
          receipt: denied,
          errorMessage: denied.decision_reason || "Route denied",
        });
      }

      const acceptedSnapshot = buildDecisionSnapshot({
        command: envelope,
        decision: "ACCEPTED",
        decisionReason: "COMMAND_ACCEPTED",
        replayStatus: "PASSED",
        route: routed.route,
      });
      receipt.evidenceRef = await this.evidenceLayer.writeDecision({
        snapshot: acceptedSnapshot,
        receipt,
      });

      await this.backbone.insertAccepted(envelope);

      if (receipt.route === "brain_gateway") {
        const result = await this.brainGateway.run(command);
        if (result.provider) receipt.provider = result.provider;
        if (result.outputPreview) receipt.outputPreview = result.outputPreview;
        if (result.externalRequestId) receipt.externalRequestId = result.externalRequestId;
      }

      const resultData = {
        accepted: true as const,
        ...(receipt.route ? { route: receipt.route } : {}),
        ...(receipt.provider ? { provider: receipt.provider } : {}),
        ...(receipt.outputPreview ? { outputPreview: receipt.outputPreview } : {}),
        ...(receipt.externalRequestId ? { externalRequestId: receipt.externalRequestId } : {}),
        ...(receipt.bridge_node_id ? { bridgeNodeId: receipt.bridge_node_id } : {}),
        ...(receipt.bridge_endpoint ? { bridgeEndpoint: receipt.bridge_endpoint } : {}),
        ...(receipt.dispatch_ref ? { dispatchRef: receipt.dispatch_ref } : {}),
        ...(receipt.dispatch_status ? { dispatchStatus: receipt.dispatch_status } : {}),
        ...(receipt.dispatch_message ? { dispatchMessage: receipt.dispatch_message } : {}),
        ...(receipt.evidenceRef ? { evidenceRef: receipt.evidenceRef } : {}),
      };

      return {
        ok: true,
        module: "command-bus",
        requestId,
        data: resultData,
        audit: {
          startedAtUtc,
          finishedAtUtc: new Date().toISOString(),
          evidenceRef: "vxstation.operations_room.command_bus.audit",
        },
      };
    } catch (error) {
      let failure: CommandReceipt | undefined;
      let failureMessage = this.errorMessage(error);
      try {
        failure = await this.rejectWithEvidence({
          command,
          envelope,
          reason: failureMessage,
          replayStatus: "PASSED",
        });
      } catch (evidenceError) {
        failureMessage = `${failureMessage}; ${this.errorMessage(evidenceError)}`;
      }
      const failureData = {
        accepted: false as const,
        ...(failure?.route ? { route: failure.route } : {}),
        ...(failure?.bridge_node_id ? { bridgeNodeId: failure.bridge_node_id } : {}),
        ...(failure?.bridge_endpoint ? { bridgeEndpoint: failure.bridge_endpoint } : {}),
        ...(failure?.dispatch_ref ? { dispatchRef: failure.dispatch_ref } : {}),
        ...(failure?.dispatch_status ? { dispatchStatus: failure.dispatch_status } : {}),
        ...(failure?.dispatch_message ? { dispatchMessage: failure.dispatch_message } : {}),
        ...(failure?.evidenceRef ? { evidenceRef: failure.evidenceRef } : {}),
      };

      return {
        ok: false,
        module: "command-bus",
        requestId,
        data: failureData,
        error: {
          code: "COMMAND_BUS_REJECTED",
          message: failureMessage,
          retryable: false,
        },
        audit: {
          startedAtUtc,
          finishedAtUtc: new Date().toISOString(),
          evidenceRef: failure?.evidenceRef || "vxstation.operations_room.command_bus.audit",
        },
      };
    }
  }

  private toEnvelope(command: SafeCommand): CommandEnvelope {
    const payloadHash = sha256(stableStringify(command.payload));
    const actorId = command.source;
    const commandId = command.command_id || generateCommandId();
    const idempotencyKey = command.idempotency_key || commandId;
    const fingerprint = buildFingerprint({
      actor_id: actorId,
      intent: command.type,
      payload_hash: payloadHash,
      idempotency_key: idempotencyKey,
    });

    const envelope: CommandEnvelope = {
      command_id: commandId,
      idempotency_key: idempotencyKey,
      nonce: command.nonce || generateNonce(),
      actor_id: actorId,
      issued_at: command.issued_at || Date.now(),
      payload_hash: payloadHash,
      causal_hash: command.causal_hash || "",
      ...(command.parent_command_id ? { parent_command_id: command.parent_command_id } : {}),
      intent: command.type,
      payload: command.payload,
      fingerprint,
      replay_window_ms: this.replayWindowMs,
      evidence_id: `ev_${commandId}`,
    };
    return envelope;
  }

  private async rejectWithEvidence(input: {
    command: SafeCommand;
    envelope: CommandEnvelope;
    reason: string;
    replayStatus: CommandReceipt["replay_status"];
  }): Promise<CommandReceipt> {
    await this.backbone.insertRejected(input.envelope);
    const receipt: CommandReceipt = {
      accepted: false,
      route: "denied",
      routedAtUtc: new Date().toISOString(),
      command_id: input.envelope.command_id,
      idempotency_key: input.envelope.idempotency_key,
      fingerprint: input.envelope.fingerprint,
      decision_status: "REJECTED",
      replay_status: input.replayStatus ?? "PASSED",
      decision_reason: input.reason,
    };
    const snapshot = buildDecisionSnapshot({
      command: input.envelope,
      decision: "REJECTED",
      decisionReason: input.reason,
      replayStatus: input.replayStatus || "PASSED",
      route: "denied",
    });
    receipt.evidenceRef = await this.evidenceLayer.writeDecision({
      snapshot,
      receipt,
    });
    return receipt;
  }

  private async normalizeCausalHash(command: CommandEnvelope): Promise<void> {
    if (command.causal_hash) {
      return;
    }

    if (command.parent_command_id) {
      const parent = await this.backbone.findCommandById(command.parent_command_id);
      if (parent) {
        command.causal_hash = sha256(`${parent.causal_hash}:${command.payload_hash}`);
        return;
      }
      command.causal_hash = sha256(`${command.parent_command_id}:${command.payload_hash}`);
      return;
    }

    command.causal_hash = sha256(`root:${command.payload_hash}`);
  }

  private buildRejectionResult(input: {
    requestId: string;
    startedAtUtc: string;
    receipt: CommandReceipt;
    errorMessage: string;
  }): ResultEnvelope<{
    accepted: boolean;
    route?: string;
    provider?: BrainProvider;
    outputPreview?: string;
    externalRequestId?: string;
    bridgeNodeId?: string;
    bridgeEndpoint?: string;
    dispatchRef?: string;
    dispatchStatus?: "accepted";
    dispatchMessage?: string;
    evidenceRef?: string;
  }> {
    const failureData = {
      accepted: false as const,
      ...(input.receipt.route ? { route: input.receipt.route } : {}),
      ...(input.receipt.bridge_node_id ? { bridgeNodeId: input.receipt.bridge_node_id } : {}),
      ...(input.receipt.bridge_endpoint ? { bridgeEndpoint: input.receipt.bridge_endpoint } : {}),
      ...(input.receipt.dispatch_ref ? { dispatchRef: input.receipt.dispatch_ref } : {}),
      ...(input.receipt.dispatch_status ? { dispatchStatus: input.receipt.dispatch_status } : {}),
      ...(input.receipt.dispatch_message
        ? { dispatchMessage: input.receipt.dispatch_message }
        : {}),
      ...(input.receipt.evidenceRef ? { evidenceRef: input.receipt.evidenceRef } : {}),
    };
    return {
      ok: false,
      module: "command-bus",
      requestId: input.requestId,
      data: failureData,
      error: {
        code: "COMMAND_BUS_REJECTED",
        message: input.errorMessage,
        retryable: false,
      },
      audit: {
        startedAtUtc: input.startedAtUtc,
        finishedAtUtc: new Date().toISOString(),
        evidenceRef: input.receipt.evidenceRef ?? "vxstation.operations_room.command_bus.audit",
      },
    };
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return "Unknown command bus error";
  }
}
