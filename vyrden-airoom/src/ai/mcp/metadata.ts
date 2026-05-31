// VYRDON AI Room — Metadata Registry
// Tracks all components, their state, capabilities, and relationships
// vyrden.com — Hidden Operations Center

import type { AgentId } from '../../core/types.js';
import type { EngineId } from '../../engines/catalog.js';

export type ComponentType = 'agent' | 'engine' | 'provider' | 'service' | 'connector';
export type ComponentStatus = 'online' | 'offline' | 'degraded' | 'initializing';

export interface ComponentMeta {
  id: string;
  type: ComponentType;
  name: string;
  status: ComponentStatus;
  version: string;
  capabilities: string[];
  dependencies: string[];
  lastHeartbeat: string;
  metadata: Record<string, unknown>;
}

export interface SystemMeta {
  startedAt: string;
  version: string;
  components: Map<string, ComponentMeta>;
  connections: Array<{ from: string; to: string; protocol: string; status: string }>;
}

export class MetadataRegistry {
  private readonly components: Map<string, ComponentMeta> = new Map();
  private readonly connections: Array<{ from: string; to: string; protocol: string; status: string }> = [];
  private readonly startedAt: string;

  constructor() {
    this.startedAt = new Date().toISOString();
  }

  // Register a component
  register(meta: Omit<ComponentMeta, 'lastHeartbeat'>): void {
    this.components.set(meta.id, {
      ...meta,
      lastHeartbeat: new Date().toISOString(),
    });
  }

  // Update status
  updateStatus(id: string, status: ComponentStatus): void {
    const comp = this.components.get(id);
    if (comp) {
      comp.status = status;
      comp.lastHeartbeat = new Date().toISOString();
    }
  }

  // Record heartbeat
  heartbeat(id: string): void {
    const comp = this.components.get(id);
    if (comp) {
      comp.lastHeartbeat = new Date().toISOString();
      if (comp.status === 'offline') {
        comp.status = 'online';
      }
    }
  }

  // Register connection between components
  connect(from: string, to: string, protocol: string): void {
    this.connections.push({ from, to, protocol, status: 'active' });
  }

  // Get component
  get(id: string): ComponentMeta | undefined {
    return this.components.get(id);
  }

  // Get all by type
  getByType(type: ComponentType): ComponentMeta[] {
    return Array.from(this.components.values()).filter(c => c.type === type);
  }

  // Get full system metadata
  getSystemMeta(): {
    startedAt: string;
    version: string;
    componentCount: number;
    onlineCount: number;
    components: ComponentMeta[];
    connections: Array<{ from: string; to: string; protocol: string; status: string }>;
  } {
    const comps = Array.from(this.components.values());
    return {
      startedAt: this.startedAt,
      version: '1.0.0',
      componentCount: comps.length,
      onlineCount: comps.filter(c => c.status === 'online').length,
      components: comps,
      connections: this.connections,
    };
  }

  // Check for stale components (no heartbeat in 60s)
  checkHealth(): Array<{ id: string; name: string; status: string; stale: boolean }> {
    const now = Date.now();
    return Array.from(this.components.values()).map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      stale: now - new Date(c.lastHeartbeat).getTime() > 60000,
    }));
  }

  // Register default VYRDON components
  registerDefaults(): void {
    // Agents
    const agents: Array<{ id: AgentId; name: string; caps: string[] }> = [
      { id: 'SEC-1', name: 'ABYSSAL', caps: ['security', 'audit', 'pentest'] },
      { id: 'CFO-1', name: 'LEVERAGE', caps: ['finance', 'treasury', 'budget'] },
      { id: 'REV-1', name: 'MAMMON', caps: ['strategy', 'market', 'revenue'] },
      { id: 'ENG-1', name: 'OBSIDIAN', caps: ['engineering', 'architecture', 'code'] },
      { id: 'ENG-2', name: 'THUNDER', caps: ['devops', 'deploy', 'infra'] },
      { id: 'BIZ-1', name: 'TITAN', caps: ['intelligence', 'analytics', 'data'] },
      { id: 'DIR-1', name: 'VYRDOX', caps: ['orchestration', 'coordination', 'routing'] },
    ];

    for (const a of agents) {
      this.register({
        id: a.id,
        type: 'agent',
        name: a.name,
        status: 'online',
        version: '1.0.0',
        capabilities: a.caps,
        dependencies: ['inference-router', 'mcp-connector', 'memory-store'],
        metadata: { clearance: a.id === 'DIR-1' || a.id === 'SEC-1' || a.id === 'REV-1' ? 5 : a.id === 'CFO-1' || a.id === 'ENG-1' ? 4 : 3 },
      });
    }

    // Core services
    this.register({
      id: 'claude-brain', type: 'service', name: 'Claude Code Logic',
      status: 'online', version: '1.0.0',
      capabilities: ['reasoning', 'decomposition', 'routing', 'evidence-chaining'],
      dependencies: ['inference-router'],
      metadata: { role: 'central-brain' },
    });

    this.register({
      id: 'mcp-connector', type: 'connector', name: 'MCP Fast Connector',
      status: 'online', version: '1.0.0',
      capabilities: ['messaging', 'routing', 'broadcast', 'channel-management'],
      dependencies: [],
      metadata: { protocol: 'MCP' },
    });

    this.register({
      id: 'memory-store', type: 'service', name: 'Memory Store',
      status: 'online', version: '1.0.0',
      capabilities: ['storage', 'retrieval', 'injection', 'templates'],
      dependencies: [],
      metadata: { persistence: 'file' },
    });

    this.register({
      id: 'inference-router', type: 'service', name: 'Inference Router',
      status: 'online', version: '2.0.0',
      capabilities: ['cloudflare-ai', 'minimax', 'ollama', 'openrouter'],
      dependencies: [],
      metadata: { primary: 'cloudflare' },
    });

    this.register({
      id: 'rag-engine', type: 'service', name: 'RAG Engine',
      status: 'online', version: '1.0.0',
      capabilities: ['retrieval', 'augmentation', 'context-building'],
      dependencies: ['memory-store', 'inference-router'],
      metadata: {},
    });

    this.register({
      id: 'omniland', type: 'service', name: 'OmniLand',
      status: 'online', version: '1.0.0',
      capabilities: ['domain-control', 'territory', 'patrol', 'scan'],
      dependencies: ['mcp-connector'],
      metadata: { domains: ['vyrden.com'] },
    });

    this.register({
      id: 'openshell', type: 'service', name: 'OpenShell',
      status: 'online', version: '1.0.0',
      capabilities: ['terminal', 'websocket', 'command-execution'],
      dependencies: ['inference-router', 'mcp-connector'],
      metadata: { protocol: 'WebSocket' },
    });

    this.register({
      id: 'agent-gateway', type: 'service', name: 'Agent Gateway',
      status: 'online', version: '1.0.0',
      capabilities: ['task-queue', 'priority-routing', 'execution', 'evidence'],
      dependencies: ['claude-brain', 'inference-router', 'mcp-connector'],
      metadata: {},
    });

    // Connections
    this.connect('claude-brain', 'inference-router', 'MCP');
    this.connect('claude-brain', 'mcp-connector', 'MCP');
    this.connect('agent-gateway', 'claude-brain', 'MCP');
    this.connect('agent-gateway', 'inference-router', 'MCP');
    this.connect('mcp-connector', 'omniland', 'MCP');
    this.connect('mcp-connector', 'openshell', 'MCP');
    this.connect('rag-engine', 'memory-store', 'direct');
    this.connect('rag-engine', 'inference-router', 'MCP');

    // Agent connections
    for (const a of agents) {
      this.connect(a.id, 'mcp-connector', 'MCP');
      this.connect(a.id, 'inference-router', 'MCP');
      this.connect('claude-brain', a.id, 'MCP');
    }
  }
}

// Singleton
let _registry: MetadataRegistry | null = null;

export function getMetadataRegistry(): MetadataRegistry {
  if (!_registry) {
    _registry = new MetadataRegistry();
    _registry.registerDefaults();
  }
  return _registry;
}
