// VYRDON AI Room — Task Scheduler
// vyrden.com — Hidden Operations Center

import { randomUUID } from 'node:crypto';
import type { AgentId } from '../../core/types.js';
import { agentRegistry } from '../../agents/registry.js';
import type { Task, TaskResult, TaskStatus, TaskPriority, AgentCapability } from './types.js';

const AGENT_CAPABILITIES: Record<AgentId, readonly string[]> = {
  'SEC-1': ['security', 'audit', 'pentest', 'threat-analysis', 'vulnerability-scan'],
  'CFO-1': ['finance', 'treasury', 'budget', 'gas-optimization', 'cost-analysis'],
  'REV-1': ['strategy', 'planning', 'decision', 'market-analysis', 'revenue'],
  'ENG-1': ['engineering', 'architecture', 'code-review', 'system-design', 'infrastructure'],
  'ENG-2': ['ops', 'deployment', 'monitoring', 'automation', 'ci-cd'],
  'BIZ-1': ['intelligence', 'analytics', 'reporting', 'data-mining', 'insights'],
  'DIR-1': ['orchestration', 'coordination', 'oversight', 'escalation', 'delegation'],
};

export class TaskScheduler {
  private readonly tasks: Map<string, Task>;
  private readonly queue: string[];
  private readonly agentLoads: Map<AgentId, number>;
  private readonly maxLoadPerAgent: number;

  constructor(maxLoadPerAgent = 5) {
    this.tasks = new Map();
    this.queue = [];
    this.agentLoads = new Map();
    this.maxLoadPerAgent = maxLoadPerAgent;
  }

  createTask(
    type: string,
    description: string,
    input: Record<string, unknown>,
    requiredCapabilities: readonly string[],
    priority: TaskPriority = 'normal',
    parentTaskId?: string,
  ): Task {
    const task: Task = {
      id: randomUUID(),
      type,
      description,
      input,
      status: 'pending',
      priority,
      requiredCapabilities,
      createdAt: new Date().toISOString(),
      evidenceRef: `vyrden.task.${Date.now()}`,
      subtaskIds: [],
      ...(parentTaskId !== undefined && { parentTaskId }),
    };

    this.tasks.set(task.id, task);
    this.enqueue(task.id, priority);

    return task;
  }

  private enqueue(taskId: string, priority: TaskPriority): void {
    const priorityOrder: Record<TaskPriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    const insertIndex = this.queue.findIndex((id) => {
      const t = this.tasks.get(id);
      return t && priorityOrder[t.priority] > priorityOrder[priority];
    });

    if (insertIndex === -1) {
      this.queue.push(taskId);
    } else {
      this.queue.splice(insertIndex, 0, taskId);
    }
  }

  assignTask(taskId: string): AgentId | null {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'pending') return null;

    const eligibleAgents = this.findEligibleAgents(task.requiredCapabilities);
    if (eligibleAgents.length === 0) return null;

    // Pick agent with lowest load
    eligibleAgents.sort((a, b) => a.currentLoad - b.currentLoad);
    const selected = eligibleAgents[0];
    if (!selected || selected.currentLoad >= selected.maxLoad) return null;

    task.assignedTo = selected.agentId;
    task.status = 'assigned';
    this.agentLoads.set(selected.agentId, (this.agentLoads.get(selected.agentId) ?? 0) + 1);

    return selected.agentId;
  }

  startTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'assigned') return false;

    task.status = 'running';
    task.startedAt = new Date().toISOString();
    return true;
  }

  completeTask(taskId: string, output: Record<string, unknown>): TaskResult {
    const task = this.tasks.get(taskId);
    if (!task) {
      return {
        taskId,
        success: false,
        error: 'TASK_NOT_FOUND',
        durationMs: 0,
        evidenceRef: `vyrden.task.${taskId}.error`,
      };
    }

    const startTime = task.startedAt ? new Date(task.startedAt).getTime() : Date.now();
    const durationMs = Date.now() - startTime;

    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.output = output;

    if (task.assignedTo) {
      const load = this.agentLoads.get(task.assignedTo) ?? 1;
      this.agentLoads.set(task.assignedTo, Math.max(0, load - 1));
    }

    this.removeFromQueue(taskId);

    return {
      taskId,
      success: true,
      output,
      durationMs,
      evidenceRef: task.evidenceRef,
    };
  }

  failTask(taskId: string, error: string): TaskResult {
    const task = this.tasks.get(taskId);
    if (!task) {
      return {
        taskId,
        success: false,
        error: 'TASK_NOT_FOUND',
        durationMs: 0,
        evidenceRef: `vyrden.task.${taskId}.error`,
      };
    }

    const startTime = task.startedAt ? new Date(task.startedAt).getTime() : Date.now();
    const durationMs = Date.now() - startTime;

    task.status = 'failed';
    task.completedAt = new Date().toISOString();
    task.error = error;

    if (task.assignedTo) {
      const load = this.agentLoads.get(task.assignedTo) ?? 1;
      this.agentLoads.set(task.assignedTo, Math.max(0, load - 1));
    }

    this.removeFromQueue(taskId);

    return {
      taskId,
      success: false,
      error,
      durationMs,
      evidenceRef: task.evidenceRef,
    };
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status === 'completed' || task.status === 'failed') return false;

    task.status = 'cancelled';
    task.completedAt = new Date().toISOString();

    if (task.assignedTo) {
      const load = this.agentLoads.get(task.assignedTo) ?? 1;
      this.agentLoads.set(task.assignedTo, Math.max(0, load - 1));
    }

    this.removeFromQueue(taskId);
    return true;
  }

  private removeFromQueue(taskId: string): void {
    const idx = this.queue.indexOf(taskId);
    if (idx !== -1) this.queue.splice(idx, 1);
  }

  private findEligibleAgents(requiredCapabilities: readonly string[]): AgentCapability[] {
    const result: AgentCapability[] = [];

    for (const [agentId, capabilities] of Object.entries(AGENT_CAPABILITIES) as [AgentId, readonly string[]][]) {
      const hasAll = requiredCapabilities.every((c) => capabilities.includes(c));
      if (!hasAll) continue;

      const isActive = agentRegistry.isActive(agentId);
      const currentLoad = this.agentLoads.get(agentId) ?? 0;

      result.push({
        agentId,
        capabilities,
        currentLoad,
        maxLoad: this.maxLoadPerAgent,
        available: isActive && currentLoad < this.maxLoadPerAgent,
      });
    }

    return result.filter((a) => a.available);
  }

  getTask(taskId: string): Task | null {
    return this.tasks.get(taskId) ?? null;
  }

  getQueuedTasks(): readonly Task[] {
    return this.queue
      .map((id) => this.tasks.get(id))
      .filter((t): t is Task => t !== undefined);
  }

  getTasksByStatus(status: TaskStatus): readonly Task[] {
    return Array.from(this.tasks.values()).filter((t) => t.status === status);
  }

  getAgentTasks(agentId: AgentId): readonly Task[] {
    return Array.from(this.tasks.values()).filter((t) => t.assignedTo === agentId);
  }

  getStats(): {
    total: number;
    byStatus: Record<TaskStatus, number>;
    queueLength: number;
    agentLoads: Record<AgentId, number>;
  } {
    const byStatus: Record<TaskStatus, number> = {
      pending: 0,
      assigned: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const task of this.tasks.values()) {
      byStatus[task.status]++;
    }

    return {
      total: this.tasks.size,
      byStatus,
      queueLength: this.queue.length,
      agentLoads: Object.fromEntries(this.agentLoads) as Record<AgentId, number>,
    };
  }
}

// Singleton instance
export const taskScheduler = new TaskScheduler();
