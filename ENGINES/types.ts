// ENGINES/types.ts
// Core types for all VXSTATION engines.
// No JSON. No config files. Types ARE the contract.

export type EngineStatus = 'idle' | 'running' | 'error' | 'disabled';
export type Priority = 'critical' | 'high' | 'normal' | 'low';
export type EngineCategory =
  | 'security' | 'engineering' | 'infra' | 'financial' | 'director'
  | 'server' | 'interconnect' | 'governance' | 'treasury' | 'intelligence'
  | 'commerce' | 'marketing' | 'operations' | 'growth' | 'people';

export interface EngineContext {
  stationRoot: string;
  timestamp: number;
  requestId: string;
  caller?: string;
}

export interface EngineResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  durationMs: number;
  engineId: string;
}

export interface EngineEvent {
  engineId: string;
  event: string;
  payload: unknown;
  timestamp: number;
}

export type EventHandler = (event: EngineEvent) => void | Promise<void>;

export interface Engine {
  readonly id: string;
  readonly type: EngineCategory;
  readonly description: string;
  status: EngineStatus;

  execute(input: unknown, ctx: EngineContext): Promise<EngineResult>;
  healthcheck(): Promise<boolean>;
  shutdown(): Promise<void>;

  // Interconnect
  feeds?: string[];          // engine IDs this engine pushes data to
  subscribes?: string[];     // event topics this engine listens to
  onEvent?: EventHandler;
}

export interface ConnectorPort {
  readonly protocol: 'unix-socket' | 'tcp' | 'stdio' | 'pty' | 'inotify' | 'rpc' | 'wss';
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(data: Buffer | string): Promise<void>;
  onData(handler: (data: Buffer) => void): void;
  readonly connected: boolean;
}

export interface TaskPayload {
  id: string;
  targetAgent: string;
  engine: string;
  priority: Priority;
  payload: unknown;
  timestamp: number;
}

export interface DirectivePayload {
  id: string;
  type: 'task' | 'config' | 'policy' | 'broadcast';
  targetAgent: string;
  directive: unknown;
  priority: Priority;
  timestamp: number;
}
