export type NodeStatus = "online" | "offline" | "degraded";

export type NodeTrustLevel = "trusted" | "restricted" | "quarantined";

export type BridgeConnectorKind = "mcp" | "http_json";

export type BridgeConnectorTransport =
  | "loopback"
  | "ssh_tunnel"
  | "local_process"
  | "remote_http";

export interface BridgeNodeConnector {
  kind: BridgeConnectorKind;
  connector_id: string;
  transport: BridgeConnectorTransport;
}

export interface BridgeNodeTopology {
  managed_by?: string;
  room_id?: string;
  role?:
    | "gateway"
    | "mcp_connector"
    | "engine"
    | "server"
    | "adapter"
    | "hook";
}

export interface BridgeNode {
  node_id: string;
  endpoint: string;
  status: NodeStatus;
  trust_level: NodeTrustLevel;
  capabilities: string[];
  last_heartbeat_at: number;
  connector?: BridgeNodeConnector;
  topology?: BridgeNodeTopology;
}

export interface NodeHeartbeatSignal {
  node_id: string;
  status: NodeStatus;
  observed_at: number;
}

export interface NodeHandshakeChallenge {
  node_id: string;
  challenge_id: string;
  challenge_token: string;
  issued_at: number;
  expires_at: number;
}

export interface NodeHandshakeResponse {
  node_id: string;
  challenge_id: string;
  signature: string;
}
