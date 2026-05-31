import { CommandReceipt, SafeCommand } from "./command.types.js";
import { PolicyLayer } from "./policy.layer.js";
import { BridgeResolver } from "../bridge/bridge.resolver.js";
import { buildBridgeRequest } from "../bridge/bridge.request.js";
import { HyperBridgeDispatcher } from "../dispatch/hyper-bridge.dispatcher.js";
import { BridgePolicy } from "../bridge/bridge.policy.js";
import { createDefaultNodeRegistry } from "../bridge/node.bootstrap.js";

interface CommandDispatcherDeps {
  policyLayer?: PolicyLayer;
  bridgeResolver?: BridgeResolver;
  hyperBridgeDispatcher?: HyperBridgeDispatcher;
}

export class CommandDispatcher {
  private readonly policyLayer: PolicyLayer;
  private bridgeResolver: BridgeResolver | null;
  private readonly hyperBridgeDispatcher: HyperBridgeDispatcher;
  private bridgeResolverInit: Promise<BridgeResolver> | null = null;

  constructor(deps: CommandDispatcherDeps = {}) {
    this.policyLayer = deps.policyLayer ?? new PolicyLayer();
    this.bridgeResolver = deps.bridgeResolver ?? null;
    this.hyperBridgeDispatcher = deps.hyperBridgeDispatcher ?? new HyperBridgeDispatcher();
  }

  private async getBridgeResolver(): Promise<BridgeResolver> {
    if (this.bridgeResolver) return this.bridgeResolver;
    if (!this.bridgeResolverInit) {
      this.bridgeResolverInit = createDefaultNodeRegistry().then(
        (registry) => new BridgeResolver(registry, new BridgePolicy()),
      );
    }
    this.bridgeResolver = await this.bridgeResolverInit;
    return this.bridgeResolver;
  }

  async dispatch(command: SafeCommand): Promise<CommandReceipt> {
    this.policyLayer.assert(command);

    if (command.target.startsWith("vxstation.bridge.")) {
      const resolver = await this.getBridgeResolver();
      const request = buildBridgeRequest(command);
      const resolution = resolver.resolve(request);
      const routed = await this.hyperBridgeDispatcher.dispatch({
        command,
        resolution,
      });
      return {
        accepted: true,
        route: routed.route,
        routedAtUtc: routed.routedAtUtc,
        bridge_node_id: routed.bridge_node_id,
        bridge_endpoint: routed.bridge_endpoint,
        dispatch_ref: routed.dispatch_ref,
        dispatch_status: routed.dispatch_status,
        ...(routed.dispatch_message ? { dispatch_message: routed.dispatch_message } : {}),
      };
    }

    if (command.target.startsWith("vxstation.brain.")) {
      return {
        accepted: true,
        route: "brain_gateway",
        routedAtUtc: new Date().toISOString(),
      };
    }

    if (command.target.startsWith("vxstation.") || command.target.startsWith("terminal.")) {
      return {
        accepted: true,
        route: "vxstation_local",
        routedAtUtc: new Date().toISOString(),
      };
    }

    if (command.target.startsWith("vyrdx.boundary.request")) {
      return {
        accepted: true,
        route: "vyrdx_boundary_request",
        routedAtUtc: new Date().toISOString(),
      };
    }

    return {
      accepted: false,
      route: "denied",
      routedAtUtc: new Date().toISOString(),
    };
  }
}
