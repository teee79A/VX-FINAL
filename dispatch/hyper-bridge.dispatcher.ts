import { SafeCommand } from "../command-bus/command.types.js";
import { BridgeResolution } from "../bridge/bridge.resolver.js";
import { DenyReasons } from "../policy/deny-reasons.js";
import { TerminalErrorCode } from "../shared/error.types.js";

export interface HyperBridgeDispatchResult {
  route: "hyper_bridge_dispatch";
  routedAtUtc: string;
  bridge_node_id: string;
  bridge_endpoint: string;
  dispatch_ref: string;
  dispatch_status: "accepted";
  dispatch_message?: string;
}

export class HyperBridgeDispatcher {
  constructor(
    private readonly fetchImpl: typeof fetch | undefined = globalThis.fetch,
    private readonly timeoutMs = 15_000,
    private readonly _getToken = () => process.env.KITTY_BRIDGE_TOKEN ?? "",
  ) {}

  async dispatch(input: {
    command: SafeCommand;
    resolution: BridgeResolution;
  }): Promise<HyperBridgeDispatchResult> {
    const dispatchRef = buildDispatchRef({
      ...(input.command.command_id ? { commandId: input.command.command_id } : {}),
      nodeId: input.resolution.node.node_id,
    });

    if (!this.fetchImpl) {
      throw new TerminalErrorCode(
        DenyReasons.BRIDGE_DISPATCH_FAILED,
        "Bridge dispatcher has no fetch implementation.",
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let dispatchMessage = "bridge_dispatch_accepted";

    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      const bridgeToken = this._getToken();
      if (bridgeToken) {
        headers["x-kitty-token"] = bridgeToken;
      }

      const response = await this.fetchImpl(`${input.resolution.node.endpoint}/dispatch`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          dispatch_ref: dispatchRef,
          command_id: input.command.command_id,
          source: input.command.source,
          intent: input.command.type,
          target: input.command.target,
          reason: input.command.reason,
          payload: input.command.payload,
        }),
        signal: controller.signal,
      });

      const body = await readJson(response);
      if (!response.ok || body?.accepted === false) {
        const reason =
          body?.reason || body?.error || `Bridge dispatch failed with status ${response.status}.`;
        throw new TerminalErrorCode(DenyReasons.BRIDGE_DISPATCH_FAILED, String(reason));
      }
      if (typeof body?.message === "string" && body.message.length > 0) {
        dispatchMessage = body.message;
      }
    } catch (error) {
      if (error instanceof TerminalErrorCode) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Unknown bridge dispatch error";
      throw new TerminalErrorCode(DenyReasons.BRIDGE_DISPATCH_FAILED, message);
    } finally {
      clearTimeout(timeout);
    }

    return {
      route: "hyper_bridge_dispatch",
      routedAtUtc: new Date().toISOString(),
      bridge_node_id: input.resolution.node.node_id,
      bridge_endpoint: input.resolution.node.endpoint,
      dispatch_ref: dispatchRef,
      dispatch_status: "accepted",
      dispatch_message: dispatchMessage,
    };
  }
}

function buildDispatchRef(input: { commandId?: string; nodeId: string }): string {
  const id = input.commandId || "untracked";
  return `bridge:${input.nodeId}:${id}`;
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}
