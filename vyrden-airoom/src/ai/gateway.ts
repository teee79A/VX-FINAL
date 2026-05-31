// VYRDON AI Room Gateway v2
// Central orchestration with Claude Code Logic, MCP, RAG
// vyrden.com — Hidden Operations Center

import { randomUUID } from 'node:crypto';
import type { AgentId, RoomMessage } from '../core/types.js';
import { agentRegistry } from '../agents/registry.js';
import { getAgentIdentity } from '../agents/identity.js';
import {
  ENGINE_CATALOG,
  ENGINE_COUNT,
  getEnginesByOwner,
  isValidEngineId,
  type EngineId,
} from '../engines/catalog.js';
import { getInferenceRouter } from './inference/router.js';
import { promptInjector } from './memory/index.js';
import { executeRealTask } from '../agents/task-executor.js';
import { findTaskByName } from '../agents/task-definitions.js';
import { getClaudeBrain } from './mcp/claude-brain.js';
import { getMCPConnector } from './mcp/connector.js';
import { getMetadataRegistry } from './mcp/metadata.js';
import { getRAGEngine } from './rag/index.js';

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';
export type TaskStatus = 'queued' | 'routing' | 'executing' | 'completed' | 'failed';

export interface Task {
  id: string;
  prompt: string;
  agentId?: AgentId;
  engineId?: EngineId;
  priority: TaskPriority;
  status: TaskStatus;
  result?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
  evidenceRef?: string;
  brainDecision?: string;
}

export interface GatewayStats {
  engineCount: number;
  agentCount: number;
  activeAgents: number;
  tasksProcessed: number;
  tasksQueued: number;
  inference: {
    mode: string;
    ollamaAvailable: boolean;
    openRouterConfigured: boolean;
    cloudflareConfigured: boolean;
    minimaxConfigured: boolean;
    activeProvider: string;
  };
  mcp: {
    channels: number;
    handlers: number;
    messageCount: number;
  };
  rag: {
    totalMemories: number;
    totalFacts: number;
    totalEvidence: number;
  };
  metadata: {
    componentCount: number;
    onlineCount: number;
  };
}

const AGENT_TO_ENGINES: Record<AgentId, readonly EngineId[]> = {
  'SEC-1': getEnginesByOwner('SEC-1'),
  'CFO-1': getEnginesByOwner('CFO-1'),
  'REV-1': getEnginesByOwner('REV-1'),
  'ENG-1': getEnginesByOwner('ENG-1'),
  'ENG-2': getEnginesByOwner('ENG-2'),
  'BIZ-1': getEnginesByOwner('BIZ-1'),
  'DIR-1': getEnginesByOwner('DIR-1'),
};

export class AIRoomGateway {
  private readonly tasks: Map<string, Task> = new Map();
  private readonly taskQueue: string[] = [];
  private processing = false;
  private tasksProcessed = 0;
  private readonly brain = getClaudeBrain();
  private readonly mcp = getMCPConnector();
  private readonly metadata = getMetadataRegistry();
  private readonly rag = getRAGEngine();

  constructor() {
    // Activate all agents on startup
    for (const agent of agentRegistry.getAll()) {
      agentRegistry.activate(agent.id);
    }

    // Register agent handlers in MCP connector
    for (const agent of agentRegistry.getAll()) {
      this.mcp.registerHandler(agent.id, async (msg) => {
        if (msg.type === 'task' && msg.payload) {
          const payload = msg.payload as { task: string };
          const result = await this.submitTask(payload.task, { agentId: agent.id as AgentId });
          return { ...msg, type: 'result', payload: result };
        }
        return undefined;
      });
      this.mcp.subscribe(agent.id, 'agents');
    }

    // Register system handler
    this.mcp.registerHandler('gateway', async (msg) => {
      if (msg.type === 'heartbeat') {
        this.metadata.heartbeat(msg.source);
      }
      return undefined;
    });
    this.mcp.subscribe('gateway', 'system');
    this.mcp.subscribe('gateway', 'control');
  }

  async submitTask(
    prompt: string,
    options?: {
      agentId?: AgentId;
      engineId?: EngineId;
      priority?: TaskPriority;
    }
  ): Promise<Task> {
    const task: Task = {
      id: randomUUID(),
      prompt,
      priority: options?.priority ?? 'normal',
      status: 'queued',
      createdAt: new Date().toISOString(),
    };

    if (options?.agentId !== undefined) {
      task.agentId = options.agentId;
    }
    if (options?.engineId !== undefined) {
      task.engineId = options.engineId;
    }

    this.tasks.set(task.id, task);
    this.enqueue(task.id, task.priority);
    this.processQueue();

    return task;
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  private enqueue(taskId: string, priority: TaskPriority): void {
    if (priority === 'critical') {
      this.taskQueue.unshift(taskId);
    } else if (priority === 'high') {
      const criticalCount = this.taskQueue.filter(
        id => this.tasks.get(id)?.priority === 'critical'
      ).length;
      this.taskQueue.splice(criticalCount, 0, taskId);
    } else {
      this.taskQueue.push(taskId);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.taskQueue.length > 0) {
      const taskId = this.taskQueue.shift();
      if (!taskId) continue;

      const task = this.tasks.get(taskId);
      if (!task) continue;

      await this.executeTask(task);
    }

    this.processing = false;
  }

  private async executeTask(task: Task): Promise<void> {
    task.status = 'routing';

    // Claude Brain analyzes and routes the task
    const decision = await this.brain.analyze(task.prompt);
    task.brainDecision = decision.reasoning;

    // Route to agent — brain decides or user specifies
    const agentId = task.agentId ?? decision.agentId ?? 'DIR-1';
    const agent = agentRegistry.get(agentId);

    if (!agent) {
      task.status = 'failed';
      task.error = `AGENT_NOT_FOUND: ${agentId}`;
      task.completedAt = new Date().toISOString();
      return;
    }

    // Notify MCP
    await this.mcp.sendTask('gateway', agentId, task.prompt);

    // Check if prompt matches a known structured task definition
    const matchedTask = findTaskByName(task.prompt);

    task.status = 'executing';

    if (decision.action === 'decompose' && decision.subtasks && decision.subtasks.length > 1) {
      // Complex task — decompose and coordinate
      try {
        const decomposed = await this.brain.decompose(task.prompt, agentId);
        const results = await this.brain.coordinateExecution(decomposed, async (subAgentId, prompt) => {
          const router = getInferenceRouter();
          const identity = getAgentIdentity(subAgentId);
          const systemPrompt = this.brain.buildEnhancedPrompt(subAgentId, prompt);
          const response = await router.generate({
            prompt,
            systemPrompt,
            model: identity.model,
            temperature: 0.7,
            maxTokens: 4096,
          });
          return response.content;
        });

        // Combine results
        const combined = Array.from(results.entries())
          .sort(([a], [b]) => a - b)
          .map(([step, result]) => `[Step ${step}] ${result}`)
          .join('\n\n');

        task.status = 'completed';
        task.result = combined;
        task.evidenceRef = `decomposed:${decomposed.id}`;
        this.tasksProcessed++;
      } catch (error) {
        task.status = 'failed';
        task.error = String(error);
      }
    } else if (matchedTask) {
      // Route through real task executor — fetches live data, then LLM analysis
      try {
        const result = await executeRealTask(matchedTask.id, {}, agentId);
        task.status = result.status === 'completed' ? 'completed' : 'failed';
        task.result = result.analysis;
        task.evidenceRef = `task:${result.taskId}`;
        this.tasksProcessed++;

        // Store evidence via brain
        this.brain.chainEvidence(task.id, agentId, result.analysis);
      } catch (error) {
        task.status = 'failed';
        task.error = String(error);
      }
    } else {
      // Standard: RAG-augmented LLM inference with Claude Code enhanced prompt
      const ragContext = this.rag.augment(task.prompt, agentId);
      const identity = getAgentIdentity(agentId);
      const fullSystemPrompt = this.brain.buildEnhancedPrompt(agentId, task.prompt, this.buildEngineContext(agentId));

      try {
        const router = getInferenceRouter();
        const response = await router.generate({
          prompt: ragContext.augmentedPrompt,
          systemPrompt: fullSystemPrompt,
          model: identity.model,
          temperature: 0.7,
          maxTokens: 4096,
        });

        task.status = 'completed';
        task.result = response.content;
        task.evidenceRef = response.evidenceRef;
        this.tasksProcessed++;

        // Record in memory and evidence chain
        promptInjector.recordInteraction(agentId, task.prompt, response.text);
        this.brain.chainEvidence(task.id, agentId, response.text);

        // Submit evidence to MCP
        await this.mcp.submitEvidence('gateway', {
          taskId: task.id,
          content: response.text.slice(0, 500),
          agentId,
        });
      } catch (error) {
        task.status = 'failed';
        task.error = String(error);
      }
    }

    task.completedAt = new Date().toISOString();
  }

  private buildEngineContext(agentId: AgentId): string {
    const engines = AGENT_TO_ENGINES[agentId] ?? [];
    const engineList = engines.slice(0, 20).map(e => {
      const spec = ENGINE_CATALOG[e];
      return `- ${e}: ${spec.desc}`;
    }).join('\n');

    return `
VYRDON LAW (Immutable):
1. Execution without evidence is void.
2. Agents are identified, not anonymous.
3. The seal cannot be retroactively modified.
4. AI Room and Runtime are separated by architecture.
5. Security operations are visible.
6. Financial operations require multi-signature.
7. The protocol is the law.

Your engines (${engines.length} total):
${engineList}${engines.length > 20 ? `\n... and ${engines.length - 20} more` : ''}

Respond concisely. Execute precisely. Evidence everything.`;
  }

  async getStats(): Promise<GatewayStats> {
    const router = getInferenceRouter();
    const inferenceStatus = await router.getStatus();
    const mcpStats = this.mcp.getStats();
    const ragStats = this.rag.getStats();
    const metaSystem = this.metadata.getSystemMeta();

    return {
      engineCount: ENGINE_COUNT,
      agentCount: agentRegistry.getAll().length,
      activeAgents: agentRegistry.getActiveCount(),
      tasksProcessed: this.tasksProcessed,
      tasksQueued: this.taskQueue.length,
      inference: {
        mode: inferenceStatus.mode,
        ollamaAvailable: inferenceStatus.ollamaAvailable,
        openRouterConfigured: inferenceStatus.openRouterConfigured,
        cloudflareConfigured: inferenceStatus.cloudflareConfigured,
        minimaxConfigured: inferenceStatus.minimaxConfigured,
        activeProvider: inferenceStatus.activeProvider,
      },
      mcp: {
        channels: mcpStats.channels,
        handlers: mcpStats.handlers,
        messageCount: mcpStats.messageCount,
      },
      rag: {
        totalMemories: ragStats.totalMemories,
        totalFacts: ragStats.totalFacts,
        totalEvidence: ragStats.totalEvidence,
      },
      metadata: {
        componentCount: metaSystem.componentCount,
        onlineCount: metaSystem.onlineCount,
      },
    };
  }

  getEnginesByAgent(agentId: AgentId): readonly EngineId[] {
    return AGENT_TO_ENGINES[agentId] ?? [];
  }

  getAllEngines(): typeof ENGINE_CATALOG {
    return ENGINE_CATALOG;
  }

  validateEngineId(id: string): id is EngineId {
    return isValidEngineId(id);
  }

  getRecentTasks(limit = 50): readonly Task[] {
    return Array.from(this.tasks.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  broadcast(message: Omit<RoomMessage, 'id' | 'timestamp'>): RoomMessage {
    const msg: RoomMessage = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...message,
    };
    // Future: WebSocket broadcast to all connected clients
    return msg;
  }
}

// Singleton
let _gateway: AIRoomGateway | null = null;

export function getGateway(): AIRoomGateway {
  if (!_gateway) {
    _gateway = new AIRoomGateway();
  }
  return _gateway;
}
