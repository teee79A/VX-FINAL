// VYRDON AI Room — Tool Guard Types
// vyrden.com — Hidden Operations Center

import type { AgentId } from '../../core/types.js';

export type ToolPermission = 'allow' | 'deny' | 'require_approval';
export type ToolCategory = 'read' | 'write' | 'execute' | 'network' | 'system' | 'dangerous';

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  parameters: readonly ToolParameter[];
  requiredPermissions: readonly ToolPermission[];
  rateLimit?: RateLimit;
  timeout?: number; // ms
  sandboxed: boolean;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  validation?: ParameterValidation;
}

export interface ParameterValidation {
  pattern?: string; // regex
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: readonly string[];
}

export interface RateLimit {
  maxCalls: number;
  windowMs: number;
}

export interface ToolExecutionRequest {
  id: string;
  toolId: string;
  agentId: AgentId;
  parameters: Record<string, unknown>;
  timestamp: string;
}

export interface ToolExecutionResult {
  requestId: string;
  toolId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
  sandboxed: boolean;
  evidenceRef: string;
}

export interface ToolPolicy {
  agentId: AgentId;
  toolId: string;
  permission: ToolPermission;
  conditions?: readonly PolicyCondition[];
}

export interface PolicyCondition {
  type: 'time_range' | 'parameter_match' | 'rate_limit';
  config: Record<string, unknown>;
}

export interface ToolGuardConfig {
  defaultPermission: ToolPermission;
  maxExecutionTimeMs: number;
  enableSandbox: boolean;
  logAllExecutions: boolean;
}
