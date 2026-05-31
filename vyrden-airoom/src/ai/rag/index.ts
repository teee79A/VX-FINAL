// VYRDON AI Room — RAG (Retrieval Augmented Generation)
// Retrieves relevant context from memory, evidence, and engine data
// Augments agent prompts with retrieved knowledge before generation
// vyrden.com — Hidden Operations Center

import type { AgentId } from '../../core/types.js';
import { memoryStore } from '../memory/store.js';
import type { MemoryEntry } from '../memory/types.js';

export interface RAGContext {
  query: string;
  retrievedChunks: RAGChunk[];
  augmentedPrompt: string;
  sourcesUsed: number;
  relevanceScore: number;
}

export interface RAGChunk {
  id: string;
  content: string;
  source: string;
  sourceType: 'memory' | 'evidence' | 'engine' | 'fact' | 'history';
  relevance: number;
  agentId?: string;
  timestamp: string;
}

// Simple keyword-based relevance scoring (no embedding model needed)
function computeRelevance(query: string, content: string): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const contentLower = content.toLowerCase();
  let matches = 0;

  for (const word of queryWords) {
    if (contentLower.includes(word)) matches++;
  }

  return queryWords.length > 0 ? matches / queryWords.length : 0;
}

export class RAGEngine {
  private readonly minRelevance = 0.15;
  private readonly maxChunks = 10;
  private readonly maxContextLength = 4000;

  // Retrieve relevant context for a query
  retrieve(query: string, agentId?: AgentId, limit?: number): RAGChunk[] {
    const max = limit ?? this.maxChunks;
    const chunks: RAGChunk[] = [];

    // 1. Search agent-specific memories
    if (agentId) {
      const agentMemories = memoryStore.getAllForAgent(agentId, 50);
      for (const mem of agentMemories) {
        const relevance = computeRelevance(query, mem.content);
        if (relevance >= this.minRelevance) {
          chunks.push(this.memoryToChunk(mem, relevance));
        }
      }
    }

    // 2. Search system-wide memories (facts, evidence)
    const systemFacts = memoryStore.query({
      type: 'fact',
      limit: 50,
    });
    for (const fact of systemFacts) {
      const relevance = computeRelevance(query, fact.content);
      if (relevance >= this.minRelevance) {
        chunks.push(this.memoryToChunk(fact, relevance));
      }
    }

    // 3. Search evidence entries
    const evidence = memoryStore.query({
      tags: ['evidence'],
      limit: 50,
    });
    for (const ev of evidence) {
      const relevance = computeRelevance(query, ev.content);
      if (relevance >= this.minRelevance) {
        chunks.push(this.memoryToChunk(ev, relevance, 'evidence'));
      }
    }

    // 4. Search interaction history
    const historyQuery: import('../memory/types.js').MemoryQuery = {
      type: 'history',
      limit: 30,
    };
    if (agentId) {
      historyQuery.agentId = agentId;
    }
    const history = memoryStore.query(historyQuery);
    for (const h of history) {
      const relevance = computeRelevance(query, h.content);
      if (relevance >= this.minRelevance) {
        chunks.push(this.memoryToChunk(h, relevance, 'history'));
      }
    }

    // Sort by relevance, deduplicate, limit
    chunks.sort((a, b) => b.relevance - a.relevance);
    const seen = new Set<string>();
    const deduped = chunks.filter(c => {
      const key = c.content.slice(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduped.slice(0, max);
  }

  // Full RAG pipeline: retrieve + augment
  augment(query: string, agentId?: AgentId): RAGContext {
    const chunks = this.retrieve(query, agentId);

    // Build augmented prompt with retrieved context
    let contextBlock = '';
    let totalLength = 0;

    for (const chunk of chunks) {
      const entry = `[${chunk.sourceType.toUpperCase()}] ${chunk.content}\n`;
      if (totalLength + entry.length > this.maxContextLength) break;
      contextBlock += entry;
      totalLength += entry.length;
    }

    const augmentedPrompt = contextBlock
      ? `--- RETRIEVED CONTEXT (RAG) ---\n${contextBlock}--- END CONTEXT ---\n\n${query}`
      : query;

    return {
      query,
      retrievedChunks: chunks,
      augmentedPrompt,
      sourcesUsed: chunks.length,
      relevanceScore: chunks.length > 0
        ? chunks.reduce((sum, c) => sum + c.relevance, 0) / chunks.length
        : 0,
    };
  }

  // Store a chunk for future retrieval
  ingest(content: string, source: string, agentId?: AgentId, tags: string[] = []): void {
    memoryStore.create({
      agentId: agentId ?? 'system',
      type: 'fact',
      content: `[${source}] ${content}`,
      metadata: { source, ingestedAt: new Date().toISOString() },
      priority: 5,
      tags: ['rag', 'ingested', ...tags],
    });
  }

  // Get RAG stats
  getStats(): {
    totalMemories: number;
    totalFacts: number;
    totalEvidence: number;
    totalHistory: number;
  } {
    const stats = memoryStore.getStats();
    return {
      totalMemories: stats.totalEntries,
      totalFacts: stats.byType['fact'] ?? 0,
      totalEvidence: stats.byType['evidence'] ?? 0,
      totalHistory: stats.byType['history'] ?? 0,
    };
  }

  private memoryToChunk(
    mem: MemoryEntry,
    relevance: number,
    sourceTypeOverride?: RAGChunk['sourceType']
  ): RAGChunk {
    return {
      id: mem.id,
      content: mem.content,
      source: `memory:${mem.agentId}`,
      sourceType: sourceTypeOverride ?? (mem.type as RAGChunk['sourceType']) ?? 'memory',
      relevance,
      agentId: mem.agentId,
      timestamp: mem.updatedAt,
    };
  }
}

// Singleton
let _rag: RAGEngine | null = null;

export function getRAGEngine(): RAGEngine {
  if (!_rag) {
    _rag = new RAGEngine();
  }
  return _rag;
}
