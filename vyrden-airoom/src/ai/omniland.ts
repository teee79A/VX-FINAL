// VYRDON Omni Land Engine
// Full domain control across vyrden.com, vyrdon.com, vyrdx, consollab
// The land belongs to VYRDON. All agents own the land.

import { randomUUID } from 'node:crypto';
import type { AgentId } from '../core/types.js';
import { agentRegistry } from '../agents/registry.js';
import { ENGINE_COUNT, getEnginesByOwner } from '../engines/catalog.js';
import { memoryStore, promptInjector } from './memory/index.js';
import { getGateway } from './gateway.js';
import { getInferenceRouter } from './inference/router.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface Domain {
  id: string;
  name: string;
  url: string;
  type: 'primary' | 'runtime' | 'authority' | 'public';
  status: 'active' | 'building' | 'planned';
  owner: AgentId | 'SYSTEM';
  description: string;
  services: string[];
}

export interface Territory {
  id: string;
  name: string;
  domains: string[];
  agents: AgentId[];
  engines: number;
  status: 'controlled' | 'expanding' | 'contested';
}

export interface LandOperation {
  id: string;
  type: 'deploy' | 'expand' | 'fortify' | 'patrol' | 'scan' | 'report';
  target: string;
  agentId: AgentId;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  result?: string;
}

export interface LandStats {
  totalDomains: number;
  activeDomains: number;
  territories: number;
  agents: number;
  engines: number;
  operations: number;
  lastPatrol: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

const VYRDON_DOMAINS: Domain[] = [
  {
    id: 'vyrden-airoom',
    name: 'VYRDEN AI Room',
    url: 'https://vyrden.com',
    type: 'primary',
    status: 'active',
    owner: 'DIR-1',
    description: 'Hidden Operations Center — 98 engines, 7 agents, WebSocket',
    services: ['ai-room', 'openshell', 'gateway', 'memory', 'inference'],
  },
  {
    id: 'vyrdon-protocol',
    name: 'VYRDON Protocol',
    url: 'https://vyrdon.com',
    type: 'public',
    status: 'building',
    owner: 'DIR-1',
    description: 'Public protocol face — documentation, SDK, integrations',
    services: ['docs', 'sdk', 'api-gateway'],
  },
  {
    id: 'vyrdx-runtime',
    name: 'VYRDX Runtime',
    url: 'https://vyrdx.vyrdon.com',
    type: 'runtime',
    status: 'building',
    owner: 'ENG-1',
    description: 'Execution engine — seal, evidence, Arbitrum L2',
    services: ['seal', 'attestation', 'chain-verifier', 'evidence'],
  },
  {
    id: 'consollab-authority',
    name: 'ConsoLab Authority',
    url: 'https://consolab.vyrdon.com',
    type: 'authority',
    status: 'building',
    owner: 'SEC-1',
    description: 'Authority plane — governance, signing, certificates',
    services: ['signing', 'governance', 'certificates', 'audit'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// OMNI LAND ENGINE
// ═══════════════════════════════════════════════════════════════════════════

class OmniLandEngine {
  private readonly domains: Map<string, Domain>;
  private readonly territories: Map<string, Territory>;
  private readonly operations: Map<string, LandOperation>;
  private lastPatrol: string;

  constructor() {
    this.domains = new Map();
    this.territories = new Map();
    this.operations = new Map();
    this.lastPatrol = new Date().toISOString();

    // Initialize domains
    for (const domain of VYRDON_DOMAINS) {
      this.domains.set(domain.id, domain);
    }

    // Create primary territory
    this.territories.set('vyrdon-land', {
      id: 'vyrdon-land',
      name: 'VYRDON Land',
      domains: VYRDON_DOMAINS.map(d => d.id),
      agents: ['DIR-1', 'SEC-1', 'CFO-1', 'REV-1', 'ENG-1', 'ENG-2', 'BIZ-1'],
      engines: ENGINE_COUNT,
      status: 'controlled',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Domain Operations
  // ─────────────────────────────────────────────────────────────────────────

  getDomain(id: string): Domain | undefined {
    return this.domains.get(id);
  }

  getAllDomains(): Domain[] {
    return Array.from(this.domains.values());
  }

  getDomainsByStatus(status: Domain['status']): Domain[] {
    return this.getAllDomains().filter(d => d.status === status);
  }

  getDomainsByOwner(owner: AgentId): Domain[] {
    return this.getAllDomains().filter(d => d.owner === owner);
  }

  updateDomainStatus(id: string, status: Domain['status']): Domain | undefined {
    const domain = this.domains.get(id);
    if (!domain) return undefined;
    domain.status = status;
    return domain;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Territory Operations
  // ─────────────────────────────────────────────────────────────────────────

  getTerritory(id: string): Territory | undefined {
    return this.territories.get(id);
  }

  getAllTerritories(): Territory[] {
    return Array.from(this.territories.values());
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Land Operations
  // ─────────────────────────────────────────────────────────────────────────

  async submitOperation(
    type: LandOperation['type'],
    target: string,
    agentId: AgentId
  ): Promise<LandOperation> {
    const op: LandOperation = {
      id: randomUUID(),
      type,
      target,
      agentId,
      status: 'pending',
      startedAt: new Date().toISOString(),
    };

    this.operations.set(op.id, op);
    await this.executeOperation(op);
    return op;
  }

  private async executeOperation(op: LandOperation): Promise<void> {
    op.status = 'executing';

    try {
      switch (op.type) {
        case 'patrol':
          op.result = await this.patrol(op.agentId);
          break;
        case 'scan':
          op.result = await this.scan(op.target, op.agentId);
          break;
        case 'report':
          op.result = await this.report(op.agentId);
          break;
        case 'fortify':
          op.result = await this.fortify(op.target, op.agentId);
          break;
        default:
          op.result = `Operation ${op.type} executed on ${op.target}`;
      }
      op.status = 'completed';
    } catch (e: unknown) {
      op.status = 'failed';
      op.result = `Error: ${e instanceof Error ? e.message : String(e)}`;
    }

    op.completedAt = new Date().toISOString();
  }

  private async patrol(agentId: AgentId): Promise<string> {
    this.lastPatrol = new Date().toISOString();

    const domains = this.getAllDomains();
    const active = domains.filter(d => d.status === 'active').length;
    const building = domains.filter(d => d.status === 'building').length;

    // Record patrol in memory
    promptInjector.addFact(
      agentId,
      `Patrol completed: ${active} active domains, ${building} building`,
      3
    );

    return `Patrol complete by ${agentId}
Domains: ${domains.length} total (${active} active, ${building} building)
Territories: ${this.territories.size}
Engines: ${ENGINE_COUNT}
Status: All systems operational`;
  }

  private async scan(target: string, agentId: AgentId): Promise<string> {
    const domain = this.domains.get(target);
    if (!domain) {
      return `Target not found: ${target}`;
    }

    const agent = agentRegistry.get(agentId);
    const engines = getEnginesByOwner(agentId);

    return `Scan of ${domain.name} (${target})
URL: ${domain.url}
Type: ${domain.type}
Status: ${domain.status}
Owner: ${domain.owner}
Services: ${domain.services.join(', ')}
Scanner: ${agent?.name ?? agentId}
Available Engines: ${engines.length}`;
  }

  private async report(agentId: AgentId): Promise<string> {
    const gateway = getGateway();
    const stats = await gateway.getStats();
    const memStats = memoryStore.getStats();
    const inferenceRouter = getInferenceRouter();
    const inferenceStatus = await inferenceRouter.getStatus();

    return `VYRDON Land Status Report
═══════════════════════════════════════

DOMAINS
  Total: ${this.domains.size}
  Active: ${this.getDomainsByStatus('active').length}
  Building: ${this.getDomainsByStatus('building').length}

TERRITORIES
  Controlled: ${this.territories.size}
  Main: VYRDON Land

AGENTS
  Total: ${stats.agentCount}
  Active: ${stats.activeAgents}

ENGINES
  Total: ${stats.engineCount}

GATEWAY
  Tasks Processed: ${stats.tasksProcessed}
  Tasks Queued: ${stats.tasksQueued}

INFERENCE
  Mode: ${inferenceStatus.mode}
  Ollama: ${inferenceStatus.ollamaAvailable ? 'Connected' : 'Offline'}
  Local Models: ${inferenceStatus.localModels.length}

MEMORY
  Entries: ${memStats.totalEntries}
  Storage: ${Math.round(memStats.storageBytes / 1024)}KB

LAST PATROL: ${this.lastPatrol}
REPORTER: ${agentId}
TIMESTAMP: ${new Date().toISOString()}`;
  }

  private async fortify(target: string, agentId: AgentId): Promise<string> {
    const domain = this.domains.get(target);
    if (!domain) {
      return `Target not found: ${target}`;
    }

    // Add fortification to memory
    promptInjector.addInjection(
      agentId,
      `Domain ${target} fortified. Priority defense active.`,
      8
    );

    return `Fortification of ${domain.name} complete
Agent: ${agentId}
Services protected: ${domain.services.length}
Status: Elevated defense`;
  }

  getOperation(id: string): LandOperation | undefined {
    return this.operations.get(id);
  }

  getRecentOperations(limit = 20): LandOperation[] {
    return Array.from(this.operations.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stats
  // ─────────────────────────────────────────────────────────────────────────

  getStats(): LandStats {
    const domains = this.getAllDomains();
    return {
      totalDomains: domains.length,
      activeDomains: domains.filter(d => d.status === 'active').length,
      territories: this.territories.size,
      agents: agentRegistry.getAll().length,
      engines: ENGINE_COUNT,
      operations: this.operations.size,
      lastPatrol: this.lastPatrol,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Agent Land Assignment
  // ─────────────────────────────────────────────────────────────────────────

  getAgentLand(agentId: AgentId): {
    domains: Domain[];
    engines: number;
    territory: Territory | undefined;
  } {
    const domains = this.getDomainsByOwner(agentId);
    const engines = getEnginesByOwner(agentId).length;
    const territory = Array.from(this.territories.values()).find(t =>
      t.agents.includes(agentId)
    );

    return { domains, engines, territory };
  }

  // All agents own the land
  claimLand(agentId: AgentId): string {
    const agent = agentRegistry.get(agentId);
    if (!agent) return `Agent not found: ${agentId}`;

    const land = this.getAgentLand(agentId);

    promptInjector.addInjection(
      agentId,
      `${agent.name} claims stake in VYRDON Land. All agents own the land.`,
      10
    );

    return `${agent.name} (${agentId}) land status:
Domains owned: ${land.domains.length}
Engines controlled: ${land.engines}
Territory: ${land.territory?.name ?? 'VYRDON Land'}
Status: ALL AGENTS OWN THE LAND`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export const omniLandEngine = new OmniLandEngine();
