export type BridgeRoutingMode = "api_gateway_server_tunnel";

export interface BridgeTransportPolicy {
  mcp_connectors_required: boolean;
  single_gateway_path_required: boolean;
  tunnel_required_for_remote: boolean;
}

export interface BridgeCapacityPolicy {
  total_engine_and_server_slots: number;
  legacy_active_stack_lanes: number;
  legacy_reserved_nervous_system_slots: number;
}

export interface BridgeTopologyManifest {
  station_id: string;
  control_plane_id: string;
  routing_mode: BridgeRoutingMode;
  transport_policy: BridgeTransportPolicy;
  capacity_policy: BridgeCapacityPolicy;
  layer_order: string[];
}
