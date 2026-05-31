import { SafeCommand } from "../command-bus/command.types.js";

export interface BridgeRequest {
  command_id?: string;
  source: SafeCommand["source"];
  intent: string;
  target: string;
  reason: string;
  payload: Record<string, unknown>;
  required_capabilities: string[];
  preferred_node_id?: string;
}

export function buildBridgeRequest(command: SafeCommand): BridgeRequest {
  const payloadCapabilities = readCapabilities(command.payload.required_capabilities);
  const requiredCapabilities = command.required_capabilities || payloadCapabilities;

  const req: BridgeRequest = {
    source: command.source,
    intent: command.type,
    target: command.target,
    reason: command.reason,
    payload: command.payload,
    required_capabilities: requiredCapabilities,
  };
  if (command.command_id) req.command_id = command.command_id;
  if (command.preferred_node_id) req.preferred_node_id = command.preferred_node_id;
  return req;
}

function readCapabilities(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((value): value is string => typeof value === "string");
}
