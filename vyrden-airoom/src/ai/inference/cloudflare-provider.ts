// VYRDON AI Room — Cloudflare Workers AI Provider
// PRIMARY inference backend — runs on Cloudflare edge, zero CPU/GPU load on droplet
// vyrden.com — Hidden Operations Center

import { randomUUID } from 'node:crypto';
import type {
  InferenceProvider,
  InferenceRequest,
  InferenceResponse,
  InferenceStreamChunk,
  ModelInfo,
} from './types.js';

// Current Cloudflare Workers AI models (2025-2026 catalog)
export const CF_MODELS = {
  // Meta Llama
  'llama-3.1-8b':     '@cf/meta/llama-3.1-8b-instruct',
  'llama-3.2-3b':     '@cf/meta/llama-3.2-3b-instruct',
  'llama-3.3-70b':    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  // Qwen
  'qwen-1.5-14b':     '@cf/qwen/qwen1.5-14b-chat-awq',
  'qwen-1.5-7b':      '@cf/qwen/qwen1.5-7b-chat-awq',
  'qwen-2.5-coder':   '@cf/qwen/qwen2.5-coder-32b-instruct',
  // Mistral
  'mistral-7b':       '@cf/mistral/mistral-7b-instruct-v0.2',
  'mistral-small':    '@cf/mistral/mistral-small-3.1-24b-instruct',
  // DeepSeek
  'deepseek-math':    '@cf/deepseek-ai/deepseek-math-7b-instruct',
  // Microsoft
  'phi-2':            '@cf/microsoft/phi-2',
  // Embeddings
  'bge-base':         '@cf/baai/bge-base-en-v1.5',
  'bge-large':        '@cf/baai/bge-large-en-v1.5',
} as const;

export type CFModelAlias = keyof typeof CF_MODELS;

// Default model for general tasks
const DEFAULT_MODEL = CF_MODELS['llama-3.1-8b'];

export class CloudflareProvider implements InferenceProvider {
  readonly name = 'cloudflare';
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly baseUrl: string;

  constructor(accountId?: string, apiToken?: string) {
    this.accountId = accountId ?? process.env['CF_ACCOUNT_ID'] ?? '';
    this.apiToken = apiToken ?? process.env['CF_API_TOKEN'] ?? '';
    this.baseUrl = 'https://api.cloudflare.com/client/v4';
  }

  private resolveModel(model?: string): string {
    if (!model) return DEFAULT_MODEL;
    // Check if it's an alias
    if (model in CF_MODELS) return CF_MODELS[model as CFModelAlias];
    // Check if it's already a full CF model ID
    if (model.startsWith('@cf/')) return model;
    // Try to match partial names
    const alias = Object.keys(CF_MODELS).find(k => model.includes(k));
    if (alias) return CF_MODELS[alias as CFModelAlias];
    return DEFAULT_MODEL;
  }

  async generate(request: InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now();
    const requestId = request.id || randomUUID();
    const model = this.resolveModel(request.model);

    const url = `${this.baseUrl}/accounts/${this.accountId}/ai/run/${model}`;

    // CF Workers AI uses messages format for chat models
    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        max_tokens: request.maxTokens ?? 2048,
        temperature: request.temperature ?? 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      throw new Error(`CF_WORKERS_FAILED: ${response.status} ${response.statusText} — ${errorText}`);
    }

    const data = await response.json() as {
      result?: { response?: string };
      success?: boolean;
      errors?: Array<{ message: string }>;
    };

    if (!data.success && data.errors?.length) {
      throw new Error(`CF_WORKERS_ERROR: ${data.errors.map(e => e.message).join(', ')}`);
    }

    const content = data.result?.response ?? '';
    const durationMs = Date.now() - startTime;

    return {
      id: requestId,
      model,
      content,
      text: content,
      tokensUsed: Math.ceil(content.length / 4), // Approximate
      durationMs,
      timestamp: new Date().toISOString(),
      evidenceRef: `vyrden.inference.cloudflare.${requestId}`,
    };
  }

  async *generateStream(request: InferenceRequest): AsyncGenerator<InferenceStreamChunk> {
    const requestId = request.id || randomUUID();
    const model = this.resolveModel(request.model);

    const url = `${this.baseUrl}/accounts/${this.accountId}/ai/run/${model}`;

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        max_tokens: request.maxTokens ?? 2048,
        temperature: request.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`CF_WORKERS_STREAM_FAILED: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('CF_WORKERS_NO_STREAM_BODY');
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
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          yield { id: requestId, content: '', done: true };
          return;
        }
        try {
          const chunk = JSON.parse(data) as { response?: string };
          if (chunk.response) {
            yield { id: requestId, content: chunk.response, done: false };
          }
        } catch {
          // Skip malformed SSE
        }
      }
    }

    yield { id: requestId, content: '', done: true };
  }

  async listModels(): Promise<readonly ModelInfo[]> {
    return Object.entries(CF_MODELS)
      .filter(([, v]) => !v.includes('bge-')) // Exclude embeddings
      .map(([alias, id]) => ({
        name: `${alias} (${id})`,
        size: 'edge',
        quantization: 'cloudflare-optimized',
        parameters: alias,
        available: true,
      }));
  }

  async isAvailable(): Promise<boolean> {
    if (!this.accountId || !this.apiToken) return false;
    try {
      // Quick test with a tiny request
      const url = `${this.baseUrl}/accounts/${this.accountId}/ai/run/${CF_MODELS['phi-2']}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // Embedding support
  async embed(text: string, model?: string): Promise<number[]> {
    const modelId = model ?? CF_MODELS['bge-base'];
    const url = `${this.baseUrl}/accounts/${this.accountId}/ai/run/${modelId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: [text] }),
    });

    if (!response.ok) {
      throw new Error(`CF_EMBED_FAILED: ${response.status}`);
    }

    const data = await response.json() as { result?: { data?: number[][] } };
    return data.result?.data?.[0] ?? [];
  }
}
