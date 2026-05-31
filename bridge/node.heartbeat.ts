import { NodeRegistry } from "./node.registry.js";
import { NodeHeartbeatSignal } from "./node.types.js";

export class NodeHeartbeat {
  constructor(
    private readonly nodeRegistry: NodeRegistry,
    private readonly staleAfterMs = 30_000
  ) {}

  record(signal: NodeHeartbeatSignal): void {
    this.nodeRegistry.recordHeartbeat({
      node_id: signal.node_id,
      status: signal.status,
      observed_at: signal.observed_at
    });
  }

  markStale(now = Date.now()): string[] {
    return this.nodeRegistry.markStale(this.staleAfterMs, now);
  }
}
