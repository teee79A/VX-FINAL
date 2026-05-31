import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { CommandBus } from "../command-bus/command.bus.js";
import { CommandBackbone } from "../command-bus/command.backbone.js";
import { EvidenceLayer } from "../evidence/evidence.layer.js";
import { JsonlEvidenceSink } from "../evidence/jsonl.sink.js";
import { EvidenceRecord, EvidenceSink } from "../evidence/evidence.sink.js";
import { CommandDispatcher } from "../command-bus/command.dispatcher.js";
import { NodeRegistry } from "../bridge/node.registry.js";
import { BridgeResolver } from "../bridge/bridge.resolver.js";
import { BridgePolicy } from "../bridge/bridge.policy.js";
import { HyperBridgeDispatcher } from "../dispatch/hyper-bridge.dispatcher.js";

async function createBus(opts?: {
  sink?: EvidenceSink;
  replayWindowMs?: number;
  dispatcher?: CommandDispatcher;
}) {
  const root = await mkdtemp(path.join(tmpdir(), "kitty-command-bus-"));
  const backbone = new CommandBackbone(path.join(root, "command_backbone"));
  const sink = opts?.sink ?? new JsonlEvidenceSink(path.join(root, "command_bus.audit.jsonl"));
  const evidenceLayer = new EvidenceLayer(backbone, sink);
  const bus = new CommandBus({
    backbone,
    evidenceLayer,
    ...(opts?.replayWindowMs !== undefined ? { replayWindowMs: opts.replayWindowMs } : {}),
    ...(opts?.dispatcher ? { dispatcher: opts.dispatcher } : {}),
  });
  return {
    bus,
    async cleanup() {
      await rm(root, { recursive: true, force: true });
    },
  };
}

describe("command bus", () => {
  it("routes allowed local command targets", async () => {
    const { bus, cleanup } = await createBus();
    try {
      const result = await bus.submit({
        type: "calendar.schedule.propose",
        source: "operator",
        target: "vxstation.calendar",
        payload: { atUtc: "2026-03-27T12:00:00Z" },
        reason: "operator requested calendar proposal",
      });

      expect(result.ok).toBe(true);
      expect(result.data?.accepted).toBe(true);
      expect(result.data?.route).toBe("vxstation_local");
    } finally {
      await cleanup();
    }
  });

  it("routes bridge targets by required capability", async () => {
    const bridgeServer = createServer((req, res) => {
      if (req.url === "/dispatch" && req.method === "POST") {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ accepted: true, message: "bridge_ok" }));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    await new Promise<void>((resolve) => bridgeServer.listen(0, "127.0.0.1", () => resolve()));
    const address = bridgeServer.address();
    const port = typeof address === "object" && address ? address.port : 0;

    const now = Date.now();
    const nodeRegistry = new NodeRegistry();
    nodeRegistry.register({
      node_id: "tuning-lab",
      endpoint: `http://127.0.0.1:${port}`,
      status: "online",
      trust_level: "trusted",
      capabilities: ["gpu.inference", "brain.vllm"],
      last_heartbeat_at: now - 1000,
    });
    nodeRegistry.register({
      node_id: "thunder",
      endpoint: "http://thunder.local:9000",
      status: "online",
      trust_level: "restricted",
      capabilities: ["gpu.inference"],
      last_heartbeat_at: now,
    });

    const dispatcher = new CommandDispatcher({
      bridgeResolver: new BridgeResolver(nodeRegistry, new BridgePolicy()),
      hyperBridgeDispatcher: new HyperBridgeDispatcher(),
    });

    const { bus, cleanup } = await createBus({ dispatcher });
    try {
      const result = await bus.submit({
        type: "brain.inference.request",
        source: "operator",
        target: "vxstation.bridge.dispatch",
        payload: { prompt: "status" },
        reason: "route by capability",
        required_capabilities: ["gpu.inference"],
      });

      expect(result.ok).toBe(true);
      expect(result.data?.route).toBe("hyper_bridge_dispatch");
      expect(result.data?.bridgeNodeId).toBe("tuning-lab");
      expect(result.data?.bridgeEndpoint).toContain("127.0.0.1");
      expect((result.data?.dispatchRef || "").startsWith("bridge:")).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) =>
        bridgeServer.close((err) => (err ? reject(err) : resolve())),
      );
      await cleanup();
    }
  });

  it("rejects module attempts to pin bridge node routes", async () => {
    const now = Date.now();
    const nodeRegistry = new NodeRegistry();
    nodeRegistry.register({
      node_id: "codex",
      endpoint: "http://codex.local:9000",
      status: "online",
      trust_level: "trusted",
      capabilities: ["gpu.inference"],
      last_heartbeat_at: now,
    });
    const dispatcher = new CommandDispatcher({
      bridgeResolver: new BridgeResolver(nodeRegistry, new BridgePolicy()),
      hyperBridgeDispatcher: new HyperBridgeDispatcher(),
    });

    const { bus, cleanup } = await createBus({ dispatcher });
    try {
      const result = await bus.submit({
        type: "brain.inference.request",
        source: "module:rag",
        target: "vxstation.bridge.dispatch",
        payload: { prompt: "route me" },
        reason: "attempt remote bypass pin",
        preferred_node_id: "codex",
        required_capabilities: ["gpu.inference"],
      });

      expect(result.ok).toBe(false);
      expect(result.error?.message).toContain("Modules cannot pin remote node routes");
    } finally {
      await cleanup();
    }
  });

  it("rejects direct runtime execution from modules", async () => {
    const { bus, cleanup } = await createBus();
    try {
      const result = await bus.submit({
        type: "vyrdx.exec.transfer",
        source: "module:calendar",
        target: "vyrdx.boundary.request",
        payload: {},
        reason: "bypass attempt",
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("COMMAND_BUS_REJECTED");
    } finally {
      await cleanup();
    }
  });

  it("rejects targets outside allowed route policy", async () => {
    const { bus, cleanup } = await createBus();
    try {
      const result = await bus.submit({
        type: "reports.export",
        source: "operator",
        target: "internet.raw",
        payload: {},
        reason: "invalid route",
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("COMMAND_BUS_REJECTED");
    } finally {
      await cleanup();
    }
  });

  it("supports local brain health path through command bus without external keys", async () => {
    const oldVllmBase = process.env.VLLM_BASE_URL;
    const oldVllmModel = process.env.VLLM_MODEL;
    const oldPriority = process.env.BRAIN_PROVIDER_PRIORITY;
    const oldOpenRouter = process.env.OPENROUTER_API_KEY;

    delete process.env.VLLM_BASE_URL;
    delete process.env.VLLM_MODEL;
    delete process.env.BRAIN_PROVIDER_PRIORITY;
    delete process.env.OPENROUTER_API_KEY;

    const { bus, cleanup } = await createBus();
    try {
      const result = await bus.submit({
        type: "brain.health.request",
        source: "operator",
        target: "vxstation.brain.health",
        payload: {},
        reason: "brain gateway health check",
      });

      expect(result.ok).toBe(true);
      expect(result.data?.accepted).toBe(true);
      expect(result.data?.route).toBe("brain_gateway");
      expect(result.data?.provider).toBe("ceo_local");
      expect((result.data?.outputPreview || "").startsWith("brain_gateway_ready:ceo_local")).toBe(
        true,
      );
    } finally {
      await cleanup();
      if (oldVllmBase === undefined) {
        delete process.env.VLLM_BASE_URL;
      } else {
        process.env.VLLM_BASE_URL = oldVllmBase;
      }
      if (oldVllmModel === undefined) {
        delete process.env.VLLM_MODEL;
      } else {
        process.env.VLLM_MODEL = oldVllmModel;
      }
      if (oldPriority === undefined) {
        delete process.env.BRAIN_PROVIDER_PRIORITY;
      } else {
        process.env.BRAIN_PROVIDER_PRIORITY = oldPriority;
      }
      if (oldOpenRouter === undefined) {
        delete process.env.OPENROUTER_API_KEY;
      } else {
        process.env.OPENROUTER_API_KEY = oldOpenRouter;
      }
    }
  }, 15000);

  it("routes brain layer targets into the local CEO runtime", async () => {
    const oldVllmBase = process.env.VLLM_BASE_URL;
    const oldPriority = process.env.BRAIN_PROVIDER_PRIORITY;
    const oldOpenRouter = process.env.OPENROUTER_API_KEY;

    delete process.env.VLLM_BASE_URL;
    delete process.env.BRAIN_PROVIDER_PRIORITY;
    delete process.env.OPENROUTER_API_KEY;

    const { bus, cleanup } = await createBus();
    try {
      const result = await bus.submit({
        type: "brain.policy.audit",
        source: "operator",
        target: "vxstation.brain.policy_router",
        payload: {},
        reason: "operator requested central brain policy audit",
      });

      expect(result.ok).toBe(true);
      expect(result.data?.accepted).toBe(true);
      expect(result.data?.route).toBe("brain_gateway");
      expect(result.data?.provider).toBe("ceo_local");
      expect(result.data?.outputPreview).toContain("ceo_local:policy");
    } finally {
      await cleanup();
      if (oldVllmBase === undefined) {
        delete process.env.VLLM_BASE_URL;
      } else {
        process.env.VLLM_BASE_URL = oldVllmBase;
      }
      if (oldPriority === undefined) {
        delete process.env.BRAIN_PROVIDER_PRIORITY;
      } else {
        process.env.BRAIN_PROVIDER_PRIORITY = oldPriority;
      }
      if (oldOpenRouter === undefined) {
        delete process.env.OPENROUTER_API_KEY;
      } else {
        process.env.OPENROUTER_API_KEY = oldOpenRouter;
      }
    }
  });

  it("rejects reused nonce", async () => {
    const { bus, cleanup } = await createBus();
    try {
      const nonce = "fixed_nonce";
      const first = await bus.submit({
        type: "calendar.schedule.propose",
        source: "operator",
        target: "vxstation.calendar",
        payload: { atUtc: "2026-03-27T13:00:00Z" },
        reason: "first",
        nonce,
        idempotency_key: "idemp-nonce-1",
      });
      expect(first.ok).toBe(true);

      const second = await bus.submit({
        type: "calendar.schedule.propose",
        source: "operator",
        target: "vxstation.calendar",
        payload: { atUtc: "2026-03-27T14:00:00Z" },
        reason: "second",
        nonce,
        idempotency_key: "idemp-nonce-2",
      });
      expect(second.ok).toBe(false);
      expect(second.error?.message).toContain("Nonce was already used");
    } finally {
      await cleanup();
    }
  });

  it("rejects idempotency conflict when key is reused with different payload hash", async () => {
    const { bus, cleanup } = await createBus();
    try {
      const idempotencyKey = "same-key";
      const first = await bus.submit({
        type: "reports.export",
        source: "operator",
        target: "vxstation.reports",
        payload: { range: "week" },
        reason: "first payload",
        idempotency_key: idempotencyKey,
      });
      expect(first.ok).toBe(true);

      const second = await bus.submit({
        type: "reports.export",
        source: "operator",
        target: "vxstation.reports",
        payload: { range: "month" },
        reason: "conflicting payload",
        idempotency_key: idempotencyKey,
      });
      expect(second.ok).toBe(false);
      expect(second.error?.message).toContain("Idempotency key was already finalized");
    } finally {
      await cleanup();
    }
  });

  it("rejects finalized duplicate fingerprint", async () => {
    const { bus, cleanup } = await createBus();
    try {
      const idempotencyKey = "same-fingerprint-key";
      const first = await bus.submit({
        type: "memory.append.note",
        source: "operator",
        target: "vxstation.memory",
        payload: { note: "same-payload" },
        reason: "initial",
        idempotency_key: idempotencyKey,
      });
      expect(first.ok).toBe(true);

      const second = await bus.submit({
        type: "memory.append.note",
        source: "operator",
        target: "vxstation.memory",
        payload: { note: "same-payload" },
        reason: "duplicate",
        idempotency_key: idempotencyKey,
      });
      expect(second.ok).toBe(false);
      expect(second.error?.message).toContain("Fingerprint already finalized");
    } finally {
      await cleanup();
    }
  });

  it("rejects command outside issuance replay window", async () => {
    const { bus, cleanup } = await createBus({ replayWindowMs: 5000 });
    try {
      const oldIssuedAt = Date.now() - 60_000;
      const result = await bus.submit({
        type: "calendar.schedule.propose",
        source: "operator",
        target: "vxstation.calendar",
        payload: { atUtc: "2026-03-27T15:00:00Z" },
        reason: "stale request",
        issued_at: oldIssuedAt,
        idempotency_key: "stale-key",
      });
      expect(result.ok).toBe(false);
      expect(result.error?.message).toContain("outside the allowed replay window");
    } finally {
      await cleanup();
    }
  });

  it("rejects causal chain mismatch", async () => {
    const { bus, cleanup } = await createBus();
    try {
      const result = await bus.submit({
        type: "reports.export",
        source: "operator",
        target: "vxstation.reports",
        payload: { range: "day" },
        reason: "invalid chain",
        parent_command_id: "missing-parent",
        causal_hash: "invalid-causal-hash",
      });
      expect(result.ok).toBe(false);
      expect(result.error?.message).toContain("Parent command does not exist");
    } finally {
      await cleanup();
    }
  });

  it("rejects flow if evidence cannot be written", async () => {
    class FailingSink implements EvidenceSink {
      async append(_record: EvidenceRecord): Promise<void> {
        throw new Error("EVIDENCE_WRITE_FAILED");
      }
      async verify(_record: EvidenceRecord): Promise<boolean> {
        return false;
      }
    }

    const { bus, cleanup } = await createBus({ sink: new FailingSink() });
    try {
      const result = await bus.submit({
        type: "calendar.schedule.propose",
        source: "operator",
        target: "vxstation.calendar",
        payload: { atUtc: "2026-03-27T16:00:00Z" },
        reason: "evidence failure check",
      });
      expect(result.ok).toBe(false);
      expect(result.error?.message).toContain("EVIDENCE_WRITE_FAILED");
    } finally {
      await cleanup();
    }
  });
});
