// consolab/heartbeat.ts
// ConsoLab Heartbeat — ASUS authority sends heartbeat to KITTY over Tailscale.
// Also receives heartbeats from other nodes to maintain the trust mesh.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// ── TYPES ──────────────────────────────────────────────────────────────────

export interface HeartbeatPayload {
  nodeId: string;
  role: "authority" | "operator" | "runtime" | "witness";
  timestamp: string;
  uptime: number;
  attestationValid: boolean;
  lastTokenRefresh: string | null;
  servicesHealthy: number;
  servicesTotal: number;
  chainHead: string;
}

export interface HeartbeatAck {
  received: boolean;
  nodeId: string;
  roundTripMs: number;
  timestamp: string;
}

export interface NodeStatus {
  nodeId: string;
  role: HeartbeatPayload["role"];
  lastSeen: string;
  healthy: boolean;
  missedBeats: number;
}

// ── CONFIG ─────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = Number(process.env.CONSOLAB_HEARTBEAT_INTERVAL_MS ?? "30000");
const HEARTBEAT_TIMEOUT_MS = Number(process.env.CONSOLAB_HEARTBEAT_TIMEOUT_MS ?? "5000");
const MAX_MISSED_BEATS = Number(process.env.CONSOLAB_MAX_MISSED_BEATS ?? "5");
const STATE_PATH = process.env.CONSOLAB_HEARTBEAT_STATE
  ?? path.join(process.env.CONSOLAB_ROOT ?? "/home/t79/ASUS_AUTHORITY", "state/heartbeat.json");

// ── HEARTBEAT MANAGER ──────────────────────────────────────────────────────

export class HeartbeatManager {
  private nodes = new Map<string, NodeStatus>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private localNodeId: string;
  private sendFn: ((target: string, payload: HeartbeatPayload) => Promise<HeartbeatAck | null>) | null = null;
  private onNodeDown: ((node: NodeStatus) => void) | null = null;

  constructor(localNodeId: string) {
    this.localNodeId = localNodeId;
  }

  setSendFunction(fn: (target: string, payload: HeartbeatPayload) => Promise<HeartbeatAck | null>): void {
    this.sendFn = fn;
  }

  setOnNodeDown(fn: (node: NodeStatus) => void): void {
    this.onNodeDown = fn;
  }

  registerNode(nodeId: string, role: HeartbeatPayload["role"]): void {
    this.nodes.set(nodeId, {
      nodeId,
      role,
      lastSeen: new Date().toISOString(),
      healthy: true,
      missedBeats: 0,
    });
  }

  // ── RECEIVE ──────────────────────────────────────────────────────────────

  receiveHeartbeat(payload: HeartbeatPayload): HeartbeatAck {
    const t0 = performance.now();

    const existing = this.nodes.get(payload.nodeId);
    this.nodes.set(payload.nodeId, {
      nodeId: payload.nodeId,
      role: payload.role,
      lastSeen: new Date().toISOString(),
      healthy: payload.attestationValid && payload.servicesHealthy > 0,
      missedBeats: 0,
    });

    if (existing && existing.missedBeats > 0) {
      console.log(`[HEARTBEAT] Node ${payload.nodeId} recovered after ${existing.missedBeats} missed beats`);
    }

    return {
      received: true,
      nodeId: this.localNodeId,
      roundTripMs: Math.round(performance.now() - t0),
      timestamp: new Date().toISOString(),
    };
  }

  // ── SEND ─────────────────────────────────────────────────────────────────

  async sendHeartbeat(payload: HeartbeatPayload): Promise<Map<string, HeartbeatAck | null>> {
    const results = new Map<string, HeartbeatAck | null>();

    for (const [nodeId] of this.nodes) {
      if (nodeId === this.localNodeId) continue;
      try {
        const ack = this.sendFn ? await this.sendFn(nodeId, payload) : null;
        results.set(nodeId, ack);
        if (ack?.received) {
          const node = this.nodes.get(nodeId);
          if (node) {
            node.lastSeen = new Date().toISOString();
            node.missedBeats = 0;
            node.healthy = true;
          }
        } else {
          this.incrementMissed(nodeId);
        }
      } catch {
        results.set(nodeId, null);
        this.incrementMissed(nodeId);
      }
    }

    return results;
  }

  private incrementMissed(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.missedBeats += 1;
    if (node.missedBeats >= MAX_MISSED_BEATS) {
      node.healthy = false;
      console.log(`[HEARTBEAT] Node ${nodeId} DOWN — ${node.missedBeats} missed beats`);
      this.onNodeDown?.(node);
    }
  }

  // ── LIFECYCLE ────────────────────────────────────────────────────────────

  start(buildPayload: () => HeartbeatPayload): void {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      const payload = buildPayload();
      await this.sendHeartbeat(payload);
      await this.persistState();
    }, HEARTBEAT_INTERVAL_MS);
    console.log(`[HEARTBEAT] Started — interval ${HEARTBEAT_INTERVAL_MS}ms, timeout ${HEARTBEAT_TIMEOUT_MS}ms`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("[HEARTBEAT] Stopped");
    }
  }

  // ── STATE ────────────────────────────────────────────────────────────────

  getStatus(): NodeStatus[] {
    return [...this.nodes.values()];
  }

  getNode(nodeId: string): NodeStatus | undefined {
    return this.nodes.get(nodeId);
  }

  private async persistState(): Promise<void> {
    try {
      await mkdir(path.dirname(STATE_PATH), { recursive: true });
      const state = {
        localNodeId: this.localNodeId,
        nodes: Object.fromEntries(this.nodes),
        timestamp: new Date().toISOString(),
      };
      await writeFile(STATE_PATH, JSON.stringify(state, null, 2));
    } catch {
      // State persistence is best-effort
    }
  }

  async loadState(): Promise<void> {
    try {
      const raw = await readFile(STATE_PATH, "utf8");
      const state = JSON.parse(raw);
      if (state.nodes) {
        for (const [id, node] of Object.entries(state.nodes)) {
          this.nodes.set(id, node as NodeStatus);
        }
      }
    } catch {
      // No previous state
    }
  }
}
