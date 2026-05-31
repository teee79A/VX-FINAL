// VYRDON AI Room — Embeddings Manager
// vyrden.com — Hidden Operations Center

import { randomUUID } from 'node:crypto';
import { OllamaEmbeddingProvider } from './ollama.js';
import { VectorStore } from './store.js';
import type {
  EmbeddingProvider,
  EmbeddingRequest,
  EmbeddingResult,
  VectorDocument,
  VectorSearchResult,
} from './types.js';

export type { EmbeddingRequest, EmbeddingResult, VectorDocument, VectorSearchResult };
export { VectorStore };

export class EmbeddingsManager {
  private readonly providers: Map<string, EmbeddingProvider>;
  private readonly stores: Map<string, VectorStore>;
  private defaultProvider: string;
  private defaultModel: string;

  constructor() {
    this.providers = new Map();
    this.stores = new Map();
    this.defaultProvider = 'ollama';
    this.defaultModel = 'nomic-embed-text';

    // Register default providers
    this.providers.set('ollama', new OllamaEmbeddingProvider());
  }

  registerProvider(provider: EmbeddingProvider): void {
    this.providers.set(provider.name, provider);
  }

  setDefaults(provider: string, model: string): void {
    this.defaultProvider = provider;
    this.defaultModel = model;
  }

  getStore(namespace = 'default'): VectorStore {
    let store = this.stores.get(namespace);
    if (!store) {
      store = new VectorStore(namespace);
      this.stores.set(namespace, store);
    }
    return store;
  }

  private getProvider(name?: string): EmbeddingProvider {
    const providerName = name ?? this.defaultProvider;
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`EMBEDDING_PROVIDER_NOT_FOUND: ${providerName}`);
    }
    return provider;
  }

  async embed(
    input: string | readonly string[],
    model?: string,
    provider?: string,
  ): Promise<EmbeddingResult> {
    const p = this.getProvider(provider);
    return p.embed({
      id: randomUUID(),
      model: model ?? this.defaultModel,
      input,
    });
  }

  async embedAndStore(
    content: string,
    metadata: Record<string, unknown> = {},
    namespace = 'default',
    model?: string,
  ): Promise<VectorDocument> {
    const result = await this.embed(content, model);
    const embedding = result.embeddings[0];

    if (!embedding) {
      throw new Error('EMBEDDING_FAILED: No embedding returned');
    }

    const doc: VectorDocument = {
      id: randomUUID(),
      content,
      embedding,
      metadata,
      createdAt: new Date().toISOString(),
    };

    this.getStore(namespace).add(doc);
    return doc;
  }

  async search(
    query: string,
    namespace = 'default',
    topK = 10,
    threshold = 0.0,
    model?: string,
  ): Promise<readonly VectorSearchResult[]> {
    const result = await this.embed(query, model);
    const queryEmbedding = result.embeddings[0];

    if (!queryEmbedding) {
      throw new Error('EMBEDDING_FAILED: No embedding returned');
    }

    return this.getStore(namespace).search(queryEmbedding, topK, threshold);
  }

  async checkHealth(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const [name, provider] of this.providers) {
      results[name] = await provider.isAvailable();
    }
    return results;
  }

  getStoreStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [name, store] of this.stores) {
      stats[name] = store.size();
    }
    return stats;
  }
}

// Singleton instance
export const embeddingsManager = new EmbeddingsManager();
