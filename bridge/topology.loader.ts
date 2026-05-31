import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { BridgeTopologyManifest } from "./topology.types.js";

const KITTY_ROOT = process.env.KITTY_ROOT ?? path.join(import.meta.dirname, "..");
export const DEFAULT_TOPOLOGY_CONFIG =
  process.env.KITTY_BRIDGE_TOPOLOGY_CONFIG ||
  path.join(KITTY_ROOT, "bridge", "topology.manifest.json");

export async function loadBridgeTopology(
  filePath = DEFAULT_TOPOLOGY_CONFIG
): Promise<BridgeTopologyManifest | null> {
  try {
    await access(filePath);
    const raw = await readFile(filePath, "utf8");
    return validateBridgeTopology(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function validateBridgeTopology(input: unknown): BridgeTopologyManifest {
  if (!input || typeof input !== "object") {
    throw new Error("BRIDGE_TOPOLOGY_INVALID");
  }

  const shape = input as Record<string, unknown>;
  const stationId = asNonEmptyString(shape.station_id, "BRIDGE_TOPOLOGY_INVALID");
  const controlPlaneId = asNonEmptyString(
    shape.control_plane_id,
    "BRIDGE_TOPOLOGY_INVALID"
  );
  const routingMode = asRoutingMode(shape.routing_mode);
  const transportPolicy = readTransportPolicy(shape.transport_policy);
  const capacityPolicy = readCapacityPolicy(shape.capacity_policy);
  const layerOrder = readStringArray(shape.layer_order);

  if (layerOrder.length === 0) {
    throw new Error("BRIDGE_TOPOLOGY_LAYERS_REQUIRED");
  }

  if (
    capacityPolicy.legacy_reserved_nervous_system_slots <
    capacityPolicy.legacy_active_stack_lanes
  ) {
    throw new Error("BRIDGE_TOPOLOGY_CAPACITY_INVALID");
  }

  if (
    capacityPolicy.total_engine_and_server_slots <
    capacityPolicy.legacy_reserved_nervous_system_slots
  ) {
    throw new Error("BRIDGE_TOPOLOGY_CAPACITY_INVALID");
  }

  return {
    station_id: stationId,
    control_plane_id: controlPlaneId,
    routing_mode: routingMode,
    transport_policy: transportPolicy,
    capacity_policy: capacityPolicy,
    layer_order: layerOrder
  };
}

export function assertTopologyCapacity(
  topology: BridgeTopologyManifest | null,
  nodeCount: number
): void {
  if (!topology) {
    return;
  }

  if (nodeCount > topology.capacity_policy.total_engine_and_server_slots) {
    throw new Error("BRIDGE_TOPOLOGY_CAPACITY_EXCEEDED");
  }
}

function readTransportPolicy(input: unknown): BridgeTopologyManifest["transport_policy"] {
  if (!input || typeof input !== "object") {
    throw new Error("BRIDGE_TOPOLOGY_INVALID");
  }

  const shape = input as Record<string, unknown>;
  return {
    mcp_connectors_required: Boolean(shape.mcp_connectors_required),
    single_gateway_path_required: Boolean(shape.single_gateway_path_required),
    tunnel_required_for_remote: Boolean(shape.tunnel_required_for_remote)
  };
}

function readCapacityPolicy(input: unknown): BridgeTopologyManifest["capacity_policy"] {
  if (!input || typeof input !== "object") {
    throw new Error("BRIDGE_TOPOLOGY_INVALID");
  }

  const shape = input as Record<string, unknown>;
  return {
    total_engine_and_server_slots: asPositiveInteger(
      shape.total_engine_and_server_slots,
      "BRIDGE_TOPOLOGY_INVALID"
    ),
    legacy_active_stack_lanes: asPositiveInteger(
      shape.legacy_active_stack_lanes,
      "BRIDGE_TOPOLOGY_INVALID"
    ),
    legacy_reserved_nervous_system_slots: asPositiveInteger(
      shape.legacy_reserved_nervous_system_slots,
      "BRIDGE_TOPOLOGY_INVALID"
    )
  };
}

function asNonEmptyString(value: unknown, errorCode: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(errorCode);
  }
  return value.trim();
}

function asPositiveInteger(value: unknown, errorCode: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(errorCode);
  }
  return value;
}

function readStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function asRoutingMode(value: unknown): BridgeTopologyManifest["routing_mode"] {
  if (value === "api_gateway_server_tunnel") {
    return value;
  }
  throw new Error("BRIDGE_TOPOLOGY_INVALID");
}
