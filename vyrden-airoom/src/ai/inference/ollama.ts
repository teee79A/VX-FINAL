// VYRDON AI Room — Ollama Inference Provider
// vyrden.com — Hidden Operations Center

import { randomUUID } from 'node:crypto';
import type {
  InferenceProvider,
  InferenceRequest,
  InferenceResponse,
  InferenceStreamChunk,
  ModelInfo,
} from './types.js';

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
  };
}

export class OllamaProvider implements InferenceProvider {
  readonly name = 'ollama';
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env['OLLAMA_HOST'] ?? 'http://localhost:11434';
  }

  async generate(request: InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now();
    const requestId = request.id || randomUUID();

    const body = {
      model: request.model,
      prompt: request.prompt,
      system: request.systemPrompt,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens ?? 2048,
      },
    };

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`OLLAMA_GENERATE_FAILED: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaGenerateResponse;
    const durationMs = Date.now() - startTime;

    return {
      id: requestId,
      model: data.model,
      content: data.response,
      text: data.response,
      tokensUsed: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      durationMs,
      timestamp: new Date().toISOString(),
      evidenceRef: `vyrden.inference.ollama.${requestId}`,
    };
  }

  async *generateStream(request: InferenceRequest): AsyncGenerator<InferenceStreamChunk> {
    const requestId = request.id || randomUUID();

    const body = {
      model: request.model,
      prompt: request.prompt,
      system: request.systemPrompt,
      stream: true,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens ?? 2048,
      },
    };

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`OLLAMA_STREAM_FAILED: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('OLLAMA_NO_STREAM_BODY');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as OllamaGenerateResponse;
        yield {
          id: requestId,
          content: chunk.response,
          done: chunk.done,
        };
      }
    }
  }

  async listModels(): Promise<readonly ModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);

    if (!response.ok) {
      throw new Error(`OLLAMA_LIST_FAILED: ${response.status}`);
    }

    const data = (await response.json()) as { models: OllamaModel[] };

    return data.models.map((m) => ({
      name: m.name,
      size: formatBytes(m.size),
      quantization: m.details?.quantization_level ?? 'unknown',
      parameters: m.details?.parameter_size ?? 'unknown',
      available: true,
    }));
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
