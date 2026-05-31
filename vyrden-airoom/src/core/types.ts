// VYRDON AI Room Core Types
// vyrden.com — Hidden Operations Center

export type AgentId =
  | 'SEC-1'   // ABYSSAL — Red Team / Security
  | 'CFO-1'   // LEVERAGE — Chief Financial
  | 'REV-1'   // MAMMON — Strategic CEO
  | 'ENG-1'   // OBSIDIAN — Engineering Lead
  | 'ENG-2'   // THUNDER — Engineering Ops
  | 'BIZ-1'   // TITAN — Business Intelligence
  | 'DIR-1'; // VYRDOX — Director / Orchestrator

export interface AgentProfile {
  id: AgentId;
  name: string;
  role: string;
  capabilities: readonly string[];
  clearanceLevel: 1 | 2 | 3 | 4 | 5;
}

export interface RoomMessage {
  id: string;
  timestamp: string;
  from: AgentId | 'SYSTEM' | 'OPERATOR';
  to: AgentId | 'ALL' | 'SYSTEM';
  type: 'command' | 'response' | 'broadcast' | 'heartbeat' | 'evidence' | 'submit_task';
  payload: Record<string, unknown>;
  evidenceRef?: string;
}

export interface EngineResult {
  engineId: string;
  type: string;
  result: Record<string, unknown>;
  timestamp: string;
  evidenceRef: string;
}

export interface RoomState {
  activeAgents: Set<AgentId>;
  engineCount: number;
  lastHeartbeat: Map<AgentId, number>;
  pendingCommands: Map<string, RoomMessage>;
}

export interface WebSocketClient {
  agentId: AgentId | 'OPERATOR';
  socket: WebSocket;
  connectedAt: number;
  lastActivity: number;
}

export interface Config {
  host: string;
  port: number;
  env: 'development' | 'production';
  kittyRoot: string;
  vyrdxRoot: string;
  corsOrigin: string;
  secret: string;
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  agentKeys: Map<AgentId, string>;
}
