// VYRDON Memory Store
// In-memory + file persistence

import type { AgentId } from '../../core/types.js';
import type { MemoryEntry, MemoryQuery, MemoryStats, PromptTemplate } from './types.js';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const MEMORY_DIR = process.env['MEMORY_DIR'] ?? join(process.cwd(), '.vyrdon-memory');
const MEMORY_FILE = join(MEMORY_DIR, 'memories.json');
const TEMPLATES_FILE = join(MEMORY_DIR, 'templates.json');

class MemoryStore {
  private memories: Map<string, MemoryEntry> = new Map();
  private templates: Map<string, PromptTemplate> = new Map();
  private dirty = false;

  constructor() {
    this.ensureDir();
    this.loadFromDisk();
    this.startAutosave();
  }

  private ensureDir(): void {
    if (!existsSync(MEMORY_DIR)) {
      mkdirSync(MEMORY_DIR, { recursive: true });
    }
  }

  private loadFromDisk(): void {
    try {
      if (existsSync(MEMORY_FILE)) {
        const data = JSON.parse(readFileSync(MEMORY_FILE, 'utf-8')) as MemoryEntry[];
        for (const entry of data) {
          this.memories.set(entry.id, entry);
        }
      }
      if (existsSync(TEMPLATES_FILE)) {
        const data = JSON.parse(readFileSync(TEMPLATES_FILE, 'utf-8')) as PromptTemplate[];
        for (const template of data) {
          this.templates.set(template.id, template);
        }
      }
    } catch {
      // Start fresh if corrupted
    }
  }

  private saveToDisk(): void {
    if (!this.dirty) return;
    try {
      writeFileSync(MEMORY_FILE, JSON.stringify([...this.memories.values()], null, 2));
      writeFileSync(TEMPLATES_FILE, JSON.stringify([...this.templates.values()], null, 2));
      this.dirty = false;
    } catch (e) {
      console.error('Memory save failed:', e);
    }
  }

  private startAutosave(): void {
    setInterval(() => this.saveToDisk(), 30000);
  }

  // Memory CRUD
  create(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): MemoryEntry {
    const now = new Date().toISOString();
    const memory: MemoryEntry = {
      ...entry,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.memories.set(memory.id, memory);
    this.dirty = true;
    return memory;
  }

  get(id: string): MemoryEntry | undefined {
    return this.memories.get(id);
  }

  update(id: string, updates: Partial<MemoryEntry>): MemoryEntry | undefined {
    const existing = this.memories.get(id);
    if (!existing) return undefined;

    const updated: MemoryEntry = {
      ...existing,
      ...updates,
      id: existing.id, // Preserve ID
      createdAt: existing.createdAt, // Preserve creation time
      updatedAt: new Date().toISOString(),
    };
    this.memories.set(id, updated);
    this.dirty = true;
    return updated;
  }

  delete(id: string): boolean {
    const result = this.memories.delete(id);
    if (result) this.dirty = true;
    return result;
  }

  query(q: MemoryQuery): MemoryEntry[] {
    const now = new Date().toISOString();
    let results = [...this.memories.values()];

    if (q.agentId) {
      results = results.filter(m => m.agentId === q.agentId);
    }
    if (q.type) {
      results = results.filter(m => m.type === q.type);
    }
    if (q.tags && q.tags.length > 0) {
      results = results.filter(m => q.tags!.some(t => m.tags.includes(t)));
    }
    if (q.minPriority !== undefined) {
      results = results.filter(m => m.priority >= q.minPriority!);
    }
    if (!q.includeExpired) {
      results = results.filter(m => !m.expiresAt || m.expiresAt > now);
    }

    // Sort by priority desc, then by updatedAt desc
    results.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    if (q.limit) {
      results = results.slice(0, q.limit);
    }

    return results;
  }

  // Get memories for injection into agent context
  getForInjection(agentId: AgentId, limit = 20): MemoryEntry[] {
    return this.query({
      agentId,
      type: 'injection',
      minPriority: 5,
      limit,
    });
  }

  // Get all memories for an agent including system
  getAllForAgent(agentId: AgentId, limit = 50): MemoryEntry[] {
    const agentMemories = this.query({ agentId, limit: limit / 2 });
    const systemMemories = this.query({ agentId: 'system', limit: limit / 2 });
    return [...agentMemories, ...systemMemories].slice(0, limit);
  }

  // Template operations
  createTemplate(template: Omit<PromptTemplate, 'id'>): PromptTemplate {
    const t: PromptTemplate = {
      ...template,
      id: randomUUID(),
    };
    this.templates.set(t.id, t);
    this.dirty = true;
    return t;
  }

  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  getAutoInjectTemplates(agentId?: AgentId): PromptTemplate[] {
    return [...this.templates.values()]
      .filter(t => t.autoInject && (!t.agentId || t.agentId === agentId))
      .sort((a, b) => b.priority - a.priority);
  }

  getAllTemplates(): PromptTemplate[] {
    return [...this.templates.values()];
  }

  deleteTemplate(id: string): boolean {
    const result = this.templates.delete(id);
    if (result) this.dirty = true;
    return result;
  }

  // Stats
  getStats(): MemoryStats {
    const entries = [...this.memories.values()];
    const byAgent: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const entry of entries) {
      byAgent[entry.agentId] = (byAgent[entry.agentId] ?? 0) + 1;
      byType[entry.type] = (byType[entry.type] ?? 0) + 1;
    }

    return {
      totalEntries: entries.length,
      byAgent,
      byType,
      storageBytes: JSON.stringify(entries).length,
    };
  }

  // Clear all
  clear(): void {
    this.memories.clear();
    this.dirty = true;
    this.saveToDisk();
  }

  // Force save
  flush(): void {
    this.dirty = true;
    this.saveToDisk();
  }
}

export const memoryStore = new MemoryStore();
