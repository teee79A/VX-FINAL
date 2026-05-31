import { readFile } from "node:fs/promises";
import path from "node:path";
import { NodeRegistry } from "./node.registry.js";
import { BridgeNode } from "./node.types.js";
import {
  assertTopologyCapacity,
  DEFAULT_TOPOLOGY_CONFIG,
  loadBridgeTopology,
} from "./topology.loader.js";

interface NodeBootstrapShape {
  nodes?: BridgeNode[];
}

const KITTY_ROOT = process.env.KITTY_ROOT ?? path.join(import.meta.dirname, "..");
const DEFAULT_NODE_CONFIG =
  process.env.KITTY_BRIDGE_NODE_CONFIG || path.join(KITTY_ROOT, "bridge", "nodes.json");

export async function createDefaultNodeRegistry(
  filePath = DEFAULT_NODE_CONFIG,
  topologyFilePath = DEFAULT_TOPOLOGY_CONFIG,
): Promise<NodeRegistry> {
  const registry = new NodeRegistry();
  const nodes = await loadNodes(filePath);
  const topology = await loadBridgeTopology(topologyFilePath);
  assertTopologyCapacity(topology, nodes.length);

  for (const node of nodes) {
    registry.register(node);
  }
  return registry;
}

async function loadNodes(filePath: string): Promise<BridgeNode[]> {
  let parsed: NodeBootstrapShape = {};
  try {
    const raw = await readFile(filePath, "utf8");
    parsed = JSON.parse(raw) as NodeBootstrapShape;
  } catch {
    return [];
  }

  const now = Date.now();
  return (parsed.nodes || [])
    .filter((node) => !!node.node_id && !!node.endpoint)
    .map((node) => {
      const mapped: BridgeNode = {
        node_id: node.node_id,
        endpoint: node.endpoint,
        status: node.status ?? "online",
        trust_level: node.trust_level ?? "trusted",
        capabilities: Array.isArray(node.capabilities) ? node.capabilities : [],
        last_heartbeat_at: node.last_heartbeat_at || now,
      };
      const conn = normalizeConnector(node.connector);
      if (conn) mapped.connector = conn;
      const topo = normalizeTopology(node.topology);
      if (topo) mapped.topology = topo;
      return mapped;
    });
}

function normalizeConnector(connector: BridgeNode["connector"]): BridgeNode["connector"] {
  if (!connector) {
    return undefined;
  }

  if (
    typeof connector.connector_id !== "string" ||
    !connector.connector_id.trim() ||
    !isConnectorKind(connector.kind) ||
    !isConnectorTransport(connector.transport)
  ) {
    return undefined;
  }

  return {
    kind: connector.kind,
    connector_id: connector.connector_id.trim(),
    transport: connector.transport,
  };
}

function normalizeTopology(topology: BridgeNode["topology"]): BridgeNode["topology"] {
  if (!topology) {
    return undefined;
  }

  const normalized: NonNullable<BridgeNode["topology"]> = {};

  if (typeof topology.managed_by === "string" && topology.managed_by.trim()) {
    normalized.managed_by = topology.managed_by.trim();
  }
  if (typeof topology.room_id === "string" && topology.room_id.trim()) {
    normalized.room_id = topology.room_id.trim();
  }
  if (isTopologyRole(topology.role)) {
    normalized.role = topology.role;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function isConnectorKind(value: unknown): value is NonNullable<BridgeNode["connector"]>["kind"] {
  return value === "mcp" || value === "http_json";
}

function isConnectorTransport(
  value: unknown,
): value is NonNullable<BridgeNode["connector"]>["transport"] {
  return (
    value === "loopback" ||
    value === "ssh_tunnel" ||
    value === "local_process" ||
    value === "remote_http"
  );
}

function isTopologyRole(
  value: unknown,
): value is "gateway" | "mcp_connector" | "engine" | "server" | "adapter" | "hook" {
  return (
    value === "gateway" ||
    value === "mcp_connector" ||
    value === "engine" ||
    value === "server" ||
    value === "adapter" ||
    value === "hook"
  );
}
