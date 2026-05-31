// VYRDON Memory System Types
// Persistent context with auto-injection

import type { AgentId } from '../../core/types.js';

export interface MemoryEntry {
  id: string;
  agentId: AgentId | 'system';
  type: 'context' | 'fact' | 'preference' | 'history' | 'injection';
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  priority: number;
  tags: string[];
}

export interface MemoryQuery {
  agentId?: AgentId | 'system';
  type?: MemoryEntry['type'];
  tags?: string[];
  limit?: number;
  minPriority?: number;
  includeExpired?: boolean;
}

export interface MemoryStats {
  totalEntries: number;
  byAgent: Record<string, number>;
  byType: Record<string, number>;
  storageBytes: number;
}

export interface InjectionContext {
  agentId: AgentId;
  prompt: string;
  memories: MemoryEntry[];
  systemPrompt: string;
  timestamp: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[];
  agentId?: AgentId;
  autoInject: boolean;
  priority: number;
}
