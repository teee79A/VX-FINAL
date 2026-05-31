import { TerminalErrorCode } from "../shared/error.types.js";
import { DenyReasons } from "../policy/deny-reasons.js";
import { hasRequiredCapabilities } from "./node.capabilities.js";
import { BridgeNode, NodeStatus } from "./node.types.js";

const TRUST_PRIORITY: Record<BridgeNode["trust_level"], number> = {
  trusted: 3,
  restricted: 2,
  quarantined: 1
};

export class NodeRegistry {
  private readonly nodes = new Map<string, BridgeNode>();

  register(node: BridgeNode): void {
    const normalized: BridgeNode = {
      ...node,
      capabilities: [...node.capabilities]
    };

    const existing = this.nodes.get(node.node_id);
    if (!existing) {
      this.nodes.set(node.node_id, normalized);
      return;
    }

    // Heartbeat updates are allowed; capability elevation is not.
    if (hasCapabilitySetChanged(existing.capabilities, normalized.capabilities)) {
      throw new TerminalErrorCode(
        DenyReasons.BRIDGE_CAPABILITY_ELEVATION_FORBIDDEN,
        "Node capabilities are immutable during runtime registration."
      );
    }

    this.nodes.set(node.node_id, {
      ...existing,
      endpoint: normalized.endpoint,
      status: normalized.status,
      trust_level: normalized.trust_level,
      last_heartbeat_at: normalized.last_heartbeat_at
    });
  }

  get(nodeId: string): BridgeNode | undefined {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return undefined;
    }
    return {
      ...node,
      capabilities: [...node.capabilities]
    };
  }

  list(): BridgeNode[] {
    return [...this.nodes.values()].map((node) => ({
      ...node,
      capabilities: [...node.capabilities]
    }));
  }

  findByCapabilities(required: readonly string[]): BridgeNode[] {
    return this.list()
      .filter((node) => hasRequiredCapabilities(node.capabilities, required))
      .sort((a, b) => {
        const trustDelta = TRUST_PRIORITY[b.trust_level] - TRUST_PRIORITY[a.trust_level];
        if (trustDelta !== 0) {
          return trustDelta;
        }
        return b.last_heartbeat_at - a.last_heartbeat_at;
      });
  }

  recordHeartbeat(input: { node_id: string; status: NodeStatus; observed_at: number }): void {
    const node = this.nodes.get(input.node_id);
    if (!node) {
      throw new TerminalErrorCode(
        DenyReasons.BRIDGE_NODE_NOT_AVAILABLE,
        `Node is not registered: ${input.node_id}`
      );
    }

    this.nodes.set(input.node_id, {
      ...node,
      status: input.status,
      last_heartbeat_at: input.observed_at
    });
  }

  markStale(thresholdMs: number, now = Date.now()): string[] {
    const stale: string[] = [];
    for (const node of this.nodes.values()) {
      if (now - node.last_heartbeat_at > thresholdMs && node.status !== "offline") {
        node.status = "offline";
        stale.push(node.node_id);
      }
    }
    return stale;
  }
}

function hasCapabilitySetChanged(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return true;
  }
  const left = [...a].sort();
  const right = [...b].sort();
  return left.some((value, index) => value !== right[index]);
}
