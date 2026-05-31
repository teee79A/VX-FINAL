// Health Dashboard — /admin/health
// vyrden.com — All agents + engines status

import { agentRegistry } from '../agents/registry.js';
import { ENGINE_CATALOG, ENGINE_COUNT } from '../engines/catalog.js';
import { getInferenceRouter } from '../ai/inference/router.js';
import { evidenceLogger } from './evidence-logger.js';

export interface EngineHealth {
  id: string;
  type: string;
  owner: string;
  status: 'operational' | 'degraded' | 'offline';
  lastCheck: string;
}

export interface AgentHealth {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  capabilities: string[];
  engines: number;
  status: 'operational' | 'degraded' | 'offline';
}

export interface HealthStatus {
  status: 'operational' | 'degraded' | 'offline';
  timestamp: string;
  uptime: number;
  agents: {
    total: number;
    active: number;
    health: AgentHealth[];
  };
  engines: {
    total: number;
    byType: Record<string, number>;
    status: string;
  };
  inference: {
    local: {
      available: boolean;
      latency?: number;
    };
    cloud: {
      available: boolean;
      latency?: number;
    };
  };
  evidence: {
    totalRequests: number;
    totalSize: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

export class HealthDashboard {
  async getFullHealth(): Promise<HealthStatus> {
    const now = new Date();
    const router = getInferenceRouter();
    const inferenceStatus = await router.getStatus();
    const evidenceStats = await evidenceLogger.getStats();

    // Agent health
    const allAgents = agentRegistry.getAll();
    const agentHealth: AgentHealth[] = allAgents.map(agent => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      isActive: agentRegistry.isActive(agent.id),
      capabilities: agent.capabilities,
      engines: getEnginesByType(agent.id).length,
      status: agentRegistry.isActive(agent.id) ? 'operational' : 'offline',
    }));

    // Engine health
    const enginesByType: Record<string, number> = {};
    for (const engine of ENGINE_CATALOG) {
      const type = engine.type;
      enginesByType[type] = (enginesByType[type] ?? 0) + 1;
    }

    // Overall status
    const activeAgents = agentHealth.filter(a => a.isActive).length;
    const allOperational = agentHealth.every(a => a.status === 'operational');
    const overallStatus = allOperational ? 'operational' : 'degraded';

    // Memory stats
    const memUsage = process.memoryUsage();

    return {
      status: overallStatus,
      timestamp: now.toISOString(),
      uptime: process.uptime(),
      agents: {
        total: allAgents.length,
        active: activeAgents,
        health: agentHealth,
      },
      engines: {
        total: ENGINE_COUNT,
        byType: enginesByType,
        status: `${ENGINE_COUNT} engines operational`,
      },
      inference: {
        local: {
          available: inferenceStatus.ollamaAvailable,
        },
        cloud: {
          available: inferenceStatus.openRouterConfigured,
        },
      },
      evidence: {
        totalRequests: evidenceStats.totalRequests,
        totalSize: evidenceStats.totalSize,
      },
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
      },
    };
  }

  async getAgentHealth(agentId: string): Promise<AgentHealth | null> {
    const agent = agentRegistry.get(agentId as unknown as Parameters<typeof agentRegistry.get>[0]);
    if (!agent) return null;

    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      isActive: agentRegistry.isActive(agent.id),
      capabilities: agent.capabilities,
      engines: getEnginesByType(agent.id).length,
      status: agentRegistry.isActive(agent.id) ? 'operational' : 'offline',
    };
  }

  async getEngineHealth(): Promise<{ total: number; byType: Record<string, number>; operational: boolean }> {
    const byType: Record<string, number> = {};
    for (const engine of ENGINE_CATALOG) {
      const type = engine.type;
      byType[type] = (byType[type] ?? 0) + 1;
    }

    return {
      total: ENGINE_COUNT,
      byType,
      operational: ENGINE_COUNT > 0,
    };
  }

  async getInferenceHealth(): Promise<{ local: boolean; cloud: boolean }> {
    const router = getInferenceRouter();
    const status = await router.getStatus();
    return {
      local: status.ollamaAvailable,
      cloud: status.openRouterConfigured,
    };
  }
}

export const healthDashboard = new HealthDashboard();
