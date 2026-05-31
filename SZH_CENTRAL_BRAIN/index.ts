import {
  CEO_ENGINE_LAYER_ORDER,
  bootCeoEngineLayers,
  bootCeoServerLayers,
  createCeoTopologySnapshot,
  type CeoEngineLayerId,
  type CeoLayerEngine,
  type CeoServerLayerId,
  type CeoServerNode,
} from "../ENGINES/ceo/index.js";
import type { EngineContext } from "../ENGINES/types.js";
import path from "node:path";
import {
  CROSS_ROOM_COORDINATION_TARGETS,
  buildCrossRoomCoordinationInput,
} from "./cross_room_coordination/index.js";
import {
  DECISION_SUPPORT_TARGETS,
  buildDecisionSupportInput,
} from "./decision_support/index.js";
import {
  ORCHESTRATION_LOGIC_TARGETS,
  buildOrchestrationLogicInput,
} from "./orchestration_logic/index.js";
import {
  POLICY_ROUTING_TARGETS,
  buildPolicyRoutingInput,
} from "./policy_routing/index.js";
import {
  STATE_SYNTHESIS_TARGETS,
  buildStateSynthesisInput,
} from "./state_synthesis/index.js";

export type CentralBrainProvider = "ceo_local";

export interface CentralBrainDispatchResult {
  provider: CentralBrainProvider;
  layer: CeoEngineLayerId;
  engineId: string;
  target: string;
  outputPreview: string;
  evidenceRef: string;
  data: unknown;
}

const TARGET_PREFIX = "vxstation.brain.";
const STATION_ROOT = process.env.KITTY_ROOT ?? path.join(import.meta.dirname, "..");

interface LocalTargetBinding {
  layer: CeoEngineLayerId;
  buildInput: (payload: Record<string, unknown>, target: string) => Record<string, unknown>;
}

function buildLayerDefaultInput(
  layer: CeoEngineLayerId,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const defaultOps: Record<CeoEngineLayerId, string> = {
    ops: "dispatch",
    system: "status",
    policy: "audit",
    trust_closure: "audit-edges",
    seal_readiness: "check",
    commercial: "status",
    market: "scan",
    feedback_ai: "aggregate",
    evidence: "audit",
    campaign: "status",
  };

  return {
    ...payload,
    op: typeof payload.op === "string" ? payload.op : defaultOps[layer],
  };
}

const LOCAL_TARGET_BINDINGS = new Map<string, LocalTargetBinding>();

for (const layer of CEO_ENGINE_LAYER_ORDER) {
  LOCAL_TARGET_BINDINGS.set(layer, {
    layer,
    buildInput: (payload) => buildLayerDefaultInput(layer, payload),
  });
}

for (const target of POLICY_ROUTING_TARGETS) {
  LOCAL_TARGET_BINDINGS.set(target, {
    layer: "policy",
    buildInput: (payload) => buildPolicyRoutingInput(payload),
  });
}

for (const target of STATE_SYNTHESIS_TARGETS) {
  LOCAL_TARGET_BINDINGS.set(target, {
    layer: "system",
    buildInput: (payload) => buildStateSynthesisInput(payload),
  });
}

for (const target of CROSS_ROOM_COORDINATION_TARGETS) {
  LOCAL_TARGET_BINDINGS.set(target, {
    layer: "ops",
    buildInput: (payload) => buildCrossRoomCoordinationInput(payload),
  });
}

for (const target of DECISION_SUPPORT_TARGETS) {
  LOCAL_TARGET_BINDINGS.set(target, {
    layer: "feedback_ai",
    buildInput: (payload) => buildDecisionSupportInput(payload),
  });
}

for (const target of ORCHESTRATION_LOGIC_TARGETS) {
  const layerMap: Record<string, CeoEngineLayerId> = {
    trust_closure: "trust_closure",
    seal_readiness: "seal_readiness",
    commercial: "commercial",
    commercial_dispatch: "commercial",
    market: "market",
    evidence: "evidence",
    archive_dispatch: "evidence",
    campaign: "campaign",
    claude_code_logic_brain: "feedback_ai",
  };

  LOCAL_TARGET_BINDINGS.set(target, {
    layer: layerMap[target]!,
    buildInput: (payload, currentTarget) =>
      buildOrchestrationLogicInput(currentTarget, payload),
  });
}

export class CentralBrainRuntime {
  private readonly engineLayers: Map<CeoEngineLayerId, CeoLayerEngine>;
  private readonly serverLayers: Map<CeoServerLayerId, CeoServerNode>;

  constructor() {
    this.engineLayers = bootCeoEngineLayers();
    this.serverLayers = bootCeoServerLayers();
  }

  async health(): Promise<{
    provider: CentralBrainProvider;
    outputPreview: string;
    evidenceRef: string;
    data: ReturnType<typeof createCeoTopologySnapshot>;
  }> {
    const snapshot = createCeoTopologySnapshot(
      this.engineLayers,
      this.serverLayers
    );

    return {
      provider: "ceo_local",
      outputPreview: `brain_gateway_ready:ceo_local:${snapshot.engineLayers.length}x${snapshot.serverLayers.length}`,
      evidenceRef: `kitty.brain.ceo_local.health.${Date.now()}`,
      data: snapshot,
    };
  }

  async dispatch(input: {
    target: string;
    payload: Record<string, unknown>;
    requestId?: string;
    caller?: string;
    issuedAt?: number;
  }): Promise<CentralBrainDispatchResult | null> {
    if (!input.target.startsWith(TARGET_PREFIX)) {
      return null;
    }

    const targetName = input.target.slice(TARGET_PREFIX.length);
    if (targetName === "health" || targetName === "topology") {
      return null;
    }

    const binding = LOCAL_TARGET_BINDINGS.get(targetName);
    if (!binding) {
      return null;
    }

    const engine = this.engineLayers.get(binding.layer);
    if (!engine) {
      throw new Error(`CENTRAL_BRAIN_LAYER_MISSING:${binding.layer}`);
    }

    const ctx: EngineContext = {
      stationRoot: STATION_ROOT,
      timestamp: input.issuedAt ?? Date.now(),
      requestId: input.requestId ?? `brain_${Date.now()}`,
      caller: input.caller ?? "brain_gateway",
    };

    const result = await engine.execute(
      binding.buildInput(input.payload, targetName),
      ctx
    );
    if (!result.ok) {
      throw new Error(
        `CENTRAL_BRAIN_EXEC_FAILED:${binding.layer}:${result.error ?? "unknown"}`
      );
    }

    return {
      provider: "ceo_local",
      layer: binding.layer,
      engineId: engine.id,
      target: input.target,
      outputPreview: summarizeBrainData(binding.layer, result.data),
      evidenceRef: `kitty.brain.ceo_local.${binding.layer}.${Date.now()}`,
      data: result.data,
    };
  }
}

function summarizeBrainData(layer: CeoEngineLayerId, data: unknown): string {
  if (!data || typeof data !== "object") {
    return `ceo_local:${layer}:ok`;
  }

  const record = data as Record<string, unknown>;
  const op = typeof record.op === "string" ? record.op : "status";

  if (typeof record.summary === "string" && record.summary) {
    return `ceo_local:${layer}:${op}:${record.summary}`.slice(0, 280);
  }
  if (typeof record.overall === "string" && record.overall) {
    return `ceo_local:${layer}:${op}:overall=${record.overall}`.slice(0, 280);
  }
  if (
    record.response &&
    typeof record.response === "object" &&
    typeof (record.response as { output?: unknown }).output === "string"
  ) {
    return `ceo_local:${layer}:${op}:${String((record.response as { output: string }).output)}`.slice(
      0,
      280
    );
  }
  if (
    record.verdict &&
    typeof record.verdict === "object" &&
    typeof (record.verdict as { reason?: unknown }).reason === "string"
  ) {
    return `ceo_local:${layer}:${op}:verdict=${String((record.verdict as { reason: string }).reason)}`.slice(
      0,
      280
    );
  }
  if (
    typeof record.signals === "number" ||
    typeof record.journalSize === "number" ||
    typeof record.lanesOnline === "number"
  ) {
    return `ceo_local:${layer}:${op}:${JSON.stringify({
      signals: record.signals,
      journalSize: record.journalSize,
      lanesOnline: record.lanesOnline,
    })}`.slice(0, 280);
  }

  return `ceo_local:${layer}:${op}:${JSON.stringify(record).slice(0, 240)}`.slice(
    0,
    280
  );
}

export const centralBrainRuntime = new CentralBrainRuntime();
