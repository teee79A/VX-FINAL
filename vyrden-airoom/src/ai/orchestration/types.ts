// VYRDON AI Room — Orchestration Types
// vyrden.com — Hidden Operations Center

import type { AgentId } from '../../core/types.js';

export type TaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface Task {
  id: string;
  type: string;
  description: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: AgentId;
  requiredCapabilities: readonly string[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  evidenceRef: string;
  parentTaskId?: string;
  subtaskIds: readonly string[];
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  durationMs: number;
  evidenceRef: string;
}

export interface AgentCapability {
  agentId: AgentId;
  capabilities: readonly string[];
  currentLoad: number;
  maxLoad: number;
  available: boolean;
}

export interface OrchestrationPlan {
  id: string;
  tasks: readonly Task[];
  dependencies: ReadonlyMap<string, readonly string[]>;
  estimatedDurationMs: number;
  createdAt: string;
}
