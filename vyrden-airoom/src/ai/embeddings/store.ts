// VYRDON AI Room — In-Memory Vector Store
// vyrden.com — Hidden Operations Center

import type { VectorDocument, VectorSearchResult } from './types.js';

export class VectorStore {
  private readonly documents: Map<string, VectorDocument>;
  private readonly namespace: string;

  constructor(namespace = 'default') {
    this.documents = new Map();
    this.namespace = namespace;
  }

  add(doc: VectorDocument): void {
    this.documents.set(doc.id, doc);
  }

  addBatch(docs: readonly VectorDocument[]): void {
    for (const doc of docs) {
      this.documents.set(doc.id, doc);
    }
  }

  get(id: string): VectorDocument | null {
    return this.documents.get(id) ?? null;
  }

  delete(id: string): boolean {
    return this.documents.delete(id);
  }

  search(queryEmbedding: readonly number[], topK = 10, threshold = 0.0): readonly VectorSearchResult[] {
    const results: VectorSearchResult[] = [];

    for (const doc of this.documents.values()) {
      const score = cosineSimilarity(queryEmbedding, doc.embedding);
      if (score >= threshold) {
        results.push({
          document: doc,
          score,
          distance: 1 - score,
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  clear(): void {
    this.documents.clear();
  }

  size(): number {
    return this.documents.size;
  }

  getNamespace(): string {
    return this.namespace;
  }

  getAllIds(): readonly string[] {
    return Array.from(this.documents.keys());
  }
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
