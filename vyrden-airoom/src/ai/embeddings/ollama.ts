// VYRDON AI Room — Ollama Embeddings Provider
// vyrden.com — Hidden Operations Center

import { randomUUID } from 'node:crypto';
import type { EmbeddingProvider, EmbeddingRequest, EmbeddingResult } from './types.js';

interface OllamaEmbedResponse {
  embedding: number[];
}

const MODEL_DIMENSIONS: Record<string, number> = {
  'nomic-embed-text': 768,
  'mxbai-embed-large': 1024,
  'all-minilm': 384,
  'snowflake-arctic-embed': 1024,
};

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'ollama';
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env['OLLAMA_HOST'] ?? 'http://localhost:11434';
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const _startTime = Date.now();
    const requestId = request.id || randomUUID();
    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    const embeddings: number[][] = [];
    let totalTokens = 0;

    for (const input of inputs) {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model,
          prompt: input,
        }),
      });

      if (!response.ok) {
        throw new Error(`OLLAMA_EMBED_FAILED: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as OllamaEmbedResponse;
      embeddings.push(data.embedding);
      totalTokens += Math.ceil(input.length / 4); // Rough token estimate
    }

    return {
      id: requestId,
      model: request.model,
      embeddings,
      dimensions: embeddings[0]?.length ?? 0,
      tokensUsed: totalTokens,
      timestamp: new Date().toISOString(),
      evidenceRef: `vyrden.embeddings.ollama.${requestId}`,
    };
  }

  getDimensions(model: string): number {
    const baseName = model.split(':')[0] ?? model;
    return MODEL_DIMENSIONS[baseName] ?? 768;
  }

  async listModels(): Promise<readonly string[]> {
    return Object.keys(MODEL_DIMENSIONS);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
