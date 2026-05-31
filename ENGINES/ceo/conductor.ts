// ENGINES/ceo/conductor.ts
// The conductor. Sits above all CEO layers.
// Receives a task → decides which layers activate → sequences them → collects results.
// No layer talks to another directly. Everything flows through here.

import { BaseEngine } from "../base.js";
import type { EngineContext, EngineResult } from "../types.js";
import {
  type CeoLayerEngine,
  type CeoServerNode,
  type CeoEngineLayerId,
  type CeoServerLayerId,
  CEO_ENGINE_LAYER_ORDER,
  bootCeoEngineLayers,
  bootCeoServerLayers,
} from "./index.js";

// ── WORKFLOW TYPES ──────────────────────────────────────

export type WorkflowStepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface WorkflowStep {
  layer: CeoEngineLayerId;
  required: boolean;
  condition?: (priorResults: Map<string, EngineResult>) => boolean;
}

export interface WorkflowResult {
  workflowId: string;
  steps: Array<{
    layer: CeoEngineLayerId;
    status: WorkflowStepStatus;
    result?: EngineResult;
    ms: number;
  }>;
  totalMs: number;
  success: boolean;
}

// ── PRE-BUILT WORKFLOWS ─────────────────────────────────

export const WORKFLOWS: Record<string, WorkflowStep[]> = {

  // Full operational cycle — every layer in order
  "full-cycle": CEO_ENGINE_LAYER_ORDER.map((layer) => ({
    layer,
    required: true,
  })),

  // Deployment pipeline — ops → system → policy → trust → seal
  "deploy": [
    { layer: "ops", required: true },
    { layer: "system", required: true },
    { layer: "policy", required: true },
    { layer: "trust_closure", required: true },
    { layer: "seal_readiness", required: true },
    { layer: "evidence", required: true },
  ],

  // Go-to-market — commercial → market → campaign → feedback
  "gtm": [
    { layer: "commercial", required: true },
    { layer: "market", required: true },
    { layer: "campaign", required: true },
    { layer: "feedback_ai", required: true },
    { layer: "evidence", required: false },
  ],

  // Security audit — trust → policy → seal → evidence
  "security-audit": [
    { layer: "trust_closure", required: true },
    { layer: "policy", required: true },
    { layer: "seal_readiness", required: true },
    { layer: "evidence", required: true },
  ],

  // Incident response — ops → system → trust → policy → evidence
  "incident": [
    { layer: "ops", required: true },
    { layer: "system", required: true },
    { layer: "trust_closure", required: true },
    { layer: "policy", required: true },
    { layer: "evidence", required: true },
    { layer: "feedback_ai", required: true },
  ],

  // Revenue cycle — commercial → market → campaign → evidence
  "revenue": [
    { layer: "commercial", required: true },
    { layer: "market", required: true },
    { layer: "campaign", required: true },
    { layer: "evidence", required: true },
  ],

  // Certification — policy → trust → seal → evidence
  "certify": [
    { layer: "policy", required: true },
    { layer: "trust_closure", required: true },
    { layer: "seal_readiness", required: true },
    { layer: "evidence", required: true },
  ],

  // Health check — ops → system → feedback
  "health": [
    { layer: "ops", required: true },
    { layer: "system", required: true },
    { layer: "feedback_ai", required: false },
  ],
};

// ── CONDUCTOR ENGINE ────────────────────────────────────

export class CeoConductor extends BaseEngine {
  readonly id = "ceo_conductor";
  readonly type = "director" as const;
  readonly description = "Orchestrates workflow across all CEO engine and server layers. The brain above the brains.";

  private engineLayers: Map<CeoEngineLayerId, CeoLayerEngine>;
  private serverLayers: Map<CeoServerLayerId, CeoServerNode>;

  constructor(
    engineLayers?: Map<CeoEngineLayerId, CeoLayerEngine>,
    serverLayers?: Map<CeoServerLayerId, CeoServerNode>,
  ) {
    super();
    this.engineLayers = engineLayers ?? bootCeoEngineLayers();
    this.serverLayers = serverLayers ?? bootCeoServerLayers();
  }

  protected async run(input: unknown, ctx: EngineContext): Promise<unknown> {
    const workflowName = (input as { workflow?: string })?.workflow ?? "full-cycle";
    const payload = (input as { payload?: unknown })?.payload ?? {};

    const workflow = WORKFLOWS[workflowName];
    if (!workflow) {
      return { error: `Unknown workflow: ${workflowName}`, available: Object.keys(WORKFLOWS) };
    }

    return this.executeWorkflow(workflowName, workflow, payload, ctx);
  }

  async executeWorkflow(
    workflowId: string,
    steps: WorkflowStep[],
    payload: unknown,
    ctx: EngineContext,
  ): Promise<WorkflowResult> {
    const t0 = performance.now();
    const results = new Map<string, EngineResult>();
    const stepResults: WorkflowResult["steps"] = [];

    for (const step of steps) {
      const engine = this.engineLayers.get(step.layer);
      if (!engine) {
        stepResults.push({ layer: step.layer, status: "failed", ms: 0 });
        if (step.required) break;
        continue;
      }

      // Check condition
      if (step.condition && !step.condition(results)) {
        stepResults.push({ layer: step.layer, status: "skipped", ms: 0 });
        continue;
      }

      // Execute layer
      const stepStart = performance.now();
      const result = await engine.execute(payload, ctx);
      const ms = Math.round(performance.now() - stepStart);

      results.set(step.layer, result);
      stepResults.push({
        layer: step.layer,
        status: result.ok ? "done" : "failed",
        result,
        ms,
      });

      // Stop on required failure
      if (!result.ok && step.required) {
        this.emit("workflow_halted", { workflowId, failedAt: step.layer, reason: result.error });
        break;
      }
    }

    const totalMs = Math.round(performance.now() - t0);
    const success = stepResults.every(
      (s) => s.status === "done" || s.status === "skipped",
    );

    this.emit("workflow_complete", { workflowId, success, totalMs, steps: stepResults.length });

    return { workflowId, steps: stepResults, totalMs, success };
  }

  // ── DIRECT LAYER ACCESS ─────────────────────────────

  async fireLayer(layer: CeoEngineLayerId, payload: unknown, ctx: EngineContext): Promise<EngineResult> {
    const engine = this.engineLayers.get(layer);
    if (!engine) return { ok: false, error: `Layer not found: ${layer}`, durationMs: 0, engineId: "ceo_conductor" };
    return engine.execute(payload, ctx);
  }

  async fireServer(serverLayer: CeoServerLayerId, payload: unknown, ctx: EngineContext): Promise<EngineResult> {
    const server = this.serverLayers.get(serverLayer);
    if (!server) return { ok: false, error: `Server not found: ${serverLayer}`, durationMs: 0, engineId: "ceo_conductor" };
    return server.execute(payload, ctx);
  }

  // ── PARALLEL EXECUTION ──────────────────────────────

  async fireParallel(layers: CeoEngineLayerId[], payload: unknown, ctx: EngineContext): Promise<Map<CeoEngineLayerId, EngineResult>> {
    const results = new Map<CeoEngineLayerId, EngineResult>();
    const promises = layers.map(async (layer) => {
      const result = await this.fireLayer(layer, payload, ctx);
      results.set(layer, result);
    });
    await Promise.allSettled(promises);
    return results;
  }

  // ── SERVER HEALTH ───────────────────────────────────

  async checkAllServers(): Promise<Map<CeoServerLayerId, boolean>> {
    const health = new Map<CeoServerLayerId, boolean>();
    for (const [layer, server] of this.serverLayers) {
      health.set(layer, await server.healthcheck());
    }
    return health;
  }

  // ── TOPOLOGY ────────────────────────────────────────

  getTopology() {
    return {
      engineLayers: [...this.engineLayers.entries()].map(([layer, e]) => ({
        slot: e.slot,
        layer,
        id: e.id,
        status: e.status,
      })),
      serverLayers: [...this.serverLayers.entries()].map(([layer, s]) => ({
        slot: s.slot,
        layer,
        id: s.id,
        status: s.status,
      })),
      workflows: Object.keys(WORKFLOWS),
    };
  }
}

// ── BOOT ────────────────────────────────────────────────

export function bootConductor(
  engineLayers?: Map<CeoEngineLayerId, CeoLayerEngine>,
  serverLayers?: Map<CeoServerLayerId, CeoServerNode>,
): CeoConductor {
  return new CeoConductor(engineLayers, serverLayers);
}
