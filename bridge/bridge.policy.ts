import { DenyReasons } from "../policy/deny-reasons.js";
import { TerminalErrorCode } from "../shared/error.types.js";
import { BridgeRequest } from "./bridge.request.js";
import { hasRequiredCapabilities } from "./node.capabilities.js";
import { BridgeNode } from "./node.types.js";

export class BridgePolicy {
  assertRequest(request: BridgeRequest): void {
    if (!request.required_capabilities.length) {
      throw new TerminalErrorCode(
        DenyReasons.BRIDGE_CAPABILITY_REQUIRED,
        "Bridge dispatch requires at least one capability."
      );
    }

    if (
      request.source.startsWith("module:") &&
      typeof request.preferred_node_id === "string"
    ) {
      throw new TerminalErrorCode(
        DenyReasons.BRIDGE_PREFERRED_NODE_FORBIDDEN,
        "Modules cannot pin remote node routes."
      );
    }
  }

  assertNodeEligibility(request: BridgeRequest, node: BridgeNode): void {
    if (node.status !== "online") {
      throw new TerminalErrorCode(
        DenyReasons.BRIDGE_NODE_NOT_AVAILABLE,
        `Node is not online: ${node.node_id}`
      );
    }

    if (node.trust_level === "quarantined") {
      throw new TerminalErrorCode(
        DenyReasons.BRIDGE_NODE_TRUST_DENIED,
        `Node trust level is denied: ${node.node_id}`
      );
    }

    if (
      request.source.startsWith("module:") &&
      node.trust_level !== "trusted"
    ) {
      throw new TerminalErrorCode(
        DenyReasons.BRIDGE_NODE_TRUST_DENIED,
        `Module requests require trusted nodes: ${node.node_id}`
      );
    }

    if (!hasRequiredCapabilities(node.capabilities, request.required_capabilities)) {
      throw new TerminalErrorCode(
        DenyReasons.BRIDGE_CAPABILITY_REQUIRED,
        `Node capability mismatch: ${node.node_id}`
      );
    }
  }
}
