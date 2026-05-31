// VYRDON AI Room Agent Registry
// 7 Agents — vyrden.com

import { type AgentId, type AgentProfile } from '../core/types.js';

const AGENTS: readonly AgentProfile[] = [
  {
    id: 'SEC-1',
    name: 'ABYSSAL',
    role: 'Red Team / Security',
    capabilities: ['threat_detection', 'vuln_scan', 'penetration', 'incident_response', 'audit'],
    clearanceLevel: 5,
  },
  {
    id: 'CFO-1',
    name: 'LEVERAGE',
    role: 'Chief Financial Officer',
    capabilities: ['treasury', 'gas_optimization', 'escrow', 'runway', 'invoicing', 'tax', 'payroll'],
    clearanceLevel: 4,
  },
  {
    id: 'REV-1',
    name: 'MAMMON',
    role: 'Strategic CEO',
    capabilities: ['strategy', 'market_analysis', 'competitor_intel', 'revenue_ops', 'growth'],
    clearanceLevel: 5,
  },
  {
    id: 'ENG-1',
    name: 'OBSIDIAN',
    role: 'Engineering Lead',
    capabilities: ['architecture', 'code_review', 'deployment', 'infrastructure', 'optimization'],
    clearanceLevel: 4,
  },
  {
    id: 'ENG-2',
    name: 'THUNDER',
    role: 'Engineering Ops',
    capabilities: ['devops', 'ci_cd', 'monitoring', 'alerting', 'scaling', 'disaster_recovery'],
    clearanceLevel: 3,
  },
  {
    id: 'BIZ-1',
    name: 'TITAN',
    role: 'Business Intelligence',
    capabilities: ['analytics', 'reporting', 'metrics', 'dashboards', 'forecasting', 'kpi'],
    clearanceLevel: 3,
  },
  {
    id: 'DIR-1',
    name: 'VYRDOX',
    role: 'Director / Orchestrator',
    capabilities: ['orchestration', 'delegation', 'priority', 'escalation', 'synthesis', 'decision'],
    clearanceLevel: 5,
  },
] as const;

export class AgentRegistry {
  private readonly agents: Map<AgentId, AgentProfile>;
  private readonly active: Set<AgentId>;

  constructor() {
    this.agents = new Map();
    this.active = new Set();
    for (const agent of AGENTS) {
      this.agents.set(agent.id, agent);
    }
  }

  get(id: AgentId): AgentProfile | undefined {
    return this.agents.get(id);
  }

  getAll(): readonly AgentProfile[] {
    return AGENTS;
  }

  activate(id: AgentId): boolean {
    if (!this.agents.has(id)) return false;
    this.active.add(id);
    return true;
  }

  deactivate(id: AgentId): boolean {
    return this.active.delete(id);
  }

  isActive(id: AgentId): boolean {
    return this.active.has(id);
  }

  getActiveIds(): readonly AgentId[] {
    return Array.from(this.active);
  }

  getActiveCount(): number {
    return this.active.size;
  }

  hasCapability(id: AgentId, capability: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    return agent.capabilities.includes(capability);
  }

  findByCapability(capability: string): readonly AgentProfile[] {
    return AGENTS.filter(a => a.capabilities.includes(capability));
  }

  findByMinClearance(level: number): readonly AgentProfile[] {
    return AGENTS.filter(a => a.clearanceLevel >= level);
  }
}

export const agentRegistry = new AgentRegistry();
