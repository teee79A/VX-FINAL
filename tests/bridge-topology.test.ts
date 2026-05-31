import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultNodeRegistry } from "../bridge/node.bootstrap.js";
import {
  assertTopologyCapacity,
  validateBridgeTopology
} from "../bridge/topology.loader.js";

describe("bridge topology", () => {
  it("validates layered MCP topology for the station", () => {
    const topology = validateBridgeTopology({
      station_id: "vxstation",
      control_plane_id: "szh_central_brain",
      routing_mode: "api_gateway_server_tunnel",
      transport_policy: {
        mcp_connectors_required: true,
        single_gateway_path_required: true,
        tunnel_required_for_remote: true
      },
      capacity_policy: {
        total_engine_and_server_slots: 523,
        legacy_active_stack_lanes: 75,
        legacy_reserved_nervous_system_slots: 150
      },
      layer_order: [
        "operation_room",
        "feedback_cloud_vyrdx_room",
        "szh_central_brain",
        "vyrdx_boundary"
      ]
    });

    expect(topology.capacity_policy.total_engine_and_server_slots).toBe(523);
    expect(topology.transport_policy.mcp_connectors_required).toBe(true);
  });

  it("rejects invalid topology capacity ordering", () => {
    expect(() =>
      validateBridgeTopology({
        station_id: "vxstation",
        control_plane_id: "szh_central_brain",
        routing_mode: "api_gateway_server_tunnel",
        transport_policy: {
          mcp_connectors_required: true,
          single_gateway_path_required: true,
          tunnel_required_for_remote: true
        },
        capacity_policy: {
          total_engine_and_server_slots: 100,
          legacy_active_stack_lanes: 75,
          legacy_reserved_nervous_system_slots: 50
        },
        layer_order: ["operation_room"]
      })
    ).toThrow("BRIDGE_TOPOLOGY_CAPACITY_INVALID");
  });

  it("rejects bridge registration beyond declared capacity", () => {
    const topology = validateBridgeTopology({
      station_id: "vxstation",
      control_plane_id: "szh_central_brain",
      routing_mode: "api_gateway_server_tunnel",
      transport_policy: {
        mcp_connectors_required: true,
        single_gateway_path_required: true,
        tunnel_required_for_remote: true
      },
      capacity_policy: {
        total_engine_and_server_slots: 1,
        legacy_active_stack_lanes: 1,
        legacy_reserved_nervous_system_slots: 1
      },
      layer_order: ["operation_room"]
    });

    expect(() => assertTopologyCapacity(topology, 2)).toThrow(
      "BRIDGE_TOPOLOGY_CAPACITY_EXCEEDED"
    );
  });

  it("enforces topology capacity during registry bootstrap", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "kitty-bridge-topology-"));
    const nodesPath = path.join(root, "nodes.json");
    const topologyPath = path.join(root, "topology.manifest.json");

    writeFileSync(
      nodesPath,
      JSON.stringify({
        nodes: [
          {
            node_id: "node-a",
            endpoint: "http://127.0.0.1:9001",
            status: "online",
            trust_level: "trusted",
            capabilities: ["ops.service.status"],
            last_heartbeat_at: 1
          },
          {
            node_id: "node-b",
            endpoint: "http://127.0.0.1:9002",
            status: "online",
            trust_level: "trusted",
            capabilities: ["ops.service.logs"],
            last_heartbeat_at: 1
          }
        ]
      }),
      "utf8"
    );

    writeFileSync(
      topologyPath,
      JSON.stringify({
        station_id: "vxstation",
        control_plane_id: "szh_central_brain",
        routing_mode: "api_gateway_server_tunnel",
        transport_policy: {
          mcp_connectors_required: true,
          single_gateway_path_required: true,
          tunnel_required_for_remote: true
        },
        capacity_policy: {
          total_engine_and_server_slots: 1,
          legacy_active_stack_lanes: 1,
          legacy_reserved_nervous_system_slots: 1
        },
        layer_order: ["operation_room"]
      }),
      "utf8"
    );

    await expect(createDefaultNodeRegistry(nodesPath, topologyPath)).rejects.toThrow(
      "BRIDGE_TOPOLOGY_CAPACITY_EXCEEDED"
    );
  });
});
