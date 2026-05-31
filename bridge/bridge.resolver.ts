import { DenyReasons } from "../policy/deny-reasons.js";
import { TerminalErrorCode } from "../shared/error.types.js";
import { BridgePolicy } from "./bridge.policy.js";
import { BridgeRequest } from "./bridge.request.js";
import { NodeRegistry } from "./node.registry.js";
import { BridgeNode } from "./node.types.js";

export interface BridgeResolution {
  node: BridgeNode;
  strategy: "preferred_node" | "capability_match";
}

export class BridgeResolver {
  constructor(
    private readonly nodeRegistry: NodeRegistry,
    private readonly bridgePolicy: BridgePolicy = new BridgePolicy()
  ) {}

  resolve(request: BridgeRequest): BridgeResolution {
    this.bridgePolicy.assertRequest(request);

    if (request.preferred_node_id) {
      const preferred = this.nodeRegistry.get(request.preferred_node_id);
      if (!preferred) {
        throw new TerminalErrorCode(
          DenyReasons.BRIDGE_NODE_NOT_AVAILABLE,
          `Preferred node is not registered: ${request.preferred_node_id}`
        );
      }
      this.bridgePolicy.assertNodeEligibility(request, preferred);
      return {
        node: preferred,
        strategy: "preferred_node"
      };
    }

    const candidates = this.nodeRegistry.findByCapabilities(
      request.required_capabilities
    );
    const selected = candidates.find((node) => {
      try {
        this.bridgePolicy.assertNodeEligibility(request, node);
        return true;
      } catch {
        return false;
      }
    });

    if (!selected) {
      throw new TerminalErrorCode(
        DenyReasons.BRIDGE_NODE_NOT_AVAILABLE,
        "No eligible node matched required capabilities."
      );
    }

    return {
      node: selected,
      strategy: "capability_match"
    };
  }
}
