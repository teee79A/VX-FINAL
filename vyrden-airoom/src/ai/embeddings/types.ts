// VYRDON AI Room — Embeddings Types
// vyrden.com — Hidden Operations Center

export interface EmbeddingRequest {
  id: string;
  model: string;
  input: string | readonly string[];
}

export interface EmbeddingResult {
  id: string;
  model: string;
  embeddings: readonly (readonly number[])[];
  dimensions: number;
  tokensUsed: number;
  timestamp: string;
  evidenceRef: string;
}

export interface EmbeddingProvider {
  name: string;
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
  getDimensions(model: string): number;
  listModels(): Promise<readonly string[]>;
  isAvailable(): Promise<boolean>;
}

export interface VectorDocument {
  id: string;
  content: string;
  embedding: readonly number[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface VectorSearchResult {
  document: VectorDocument;
  score: number;
  distance: number;
}
