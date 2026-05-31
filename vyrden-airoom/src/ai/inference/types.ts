// VYRDON AI Room — Inference Types
// vyrden.com — Hidden Operations Center

export interface InferenceRequest {
  id?: string;
  model?: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  agentId?: string;
}

export interface InferenceResponse {
  id: string;
  model: string;
  content: string;
  text: string; // Alias for content
  tokensUsed: number;
  durationMs: number;
  timestamp: string;
  evidenceRef: string;
}

export interface InferenceStreamChunk {
  id: string;
  content: string;
  done: boolean;
}

export interface ModelInfo {
  name: string;
  size: string;
  quantization: string;
  parameters: string;
  available: boolean;
}

export interface InferenceProvider {
  name: string;
  generate(request: InferenceRequest): Promise<InferenceResponse>;
  generateStream(request: InferenceRequest): AsyncGenerator<InferenceStreamChunk>;
  listModels(): Promise<readonly ModelInfo[]>;
  isAvailable(): Promise<boolean>;
}
