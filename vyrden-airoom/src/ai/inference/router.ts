// VYRDON AI Room — Inference Router v2
// Multi-provider: Cloudflare Workers AI (primary) → MiniMax → Ollama → OpenRouter
// vyrden.com — Hidden Operations Center

import { randomUUID } from 'node:crypto';
import { OllamaProvider } from './ollama.js';
import { CloudflareProvider, CF_MODELS } from './cloudflare-provider.js';
import { MiniMaxProvider } from './minimax-provider.js';
import type { InferenceProvider, InferenceRequest, InferenceResponse, InferenceStreamChunk, ModelInfo } from './types.js';

export type InferenceMode = 'cloudflare' | 'minimax' | 'ollama' | 'openrouter' | 'auto';

interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface RouterConfig {
  mode: InferenceMode;
  ollamaHost?: string;
  openRouterKey?: string;
  preferredCloudModel: string;
}

const DEFAULT_CONFIG: RouterConfig = {
  mode: 'auto',
  preferredCloudModel: '@cf/meta/llama-3.1-8b-instruct',
};

// Provider priority chain for auto mode
const PROVIDER_CHAIN: readonly string[] = ['cloudflare', 'minimax', 'ollama', 'openrouter'];

export class InferenceRouter {
  private readonly providers: Map<string, InferenceProvider> = new Map();
  private readonly config: RouterConfig;
  private readonly openRouterKey: string | undefined;
  private providerCache: Map<string, boolean> = new Map();
  private cacheExpiry = 0;

  constructor(config?: Partial<RouterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.openRouterKey = config?.openRouterKey ?? process.env['OPENROUTER_API_KEY'] ?? undefined;

    // Register all providers
    this.providers.set('cloudflare', new CloudflareProvider());
    this.providers.set('minimax', new MiniMaxProvider());
    this.providers.set('ollama', new OllamaProvider(this.config.ollamaHost));
  }

  async generate(request: InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now();
    const requestId = request.id || randomUUID();

    // Determine provider chain based on mode
    const chain = this.config.mode === 'auto'
      ? PROVIDER_CHAIN
      : [this.config.mode];

    // Try each provider in chain
    for (const providerName of chain) {
      try {
        if (providerName === 'openrouter') {
          // OpenRouter is a special case — not a standard provider
          if (!this.openRouterKey) continue;
          return await this.generateOpenRouter(request, requestId, startTime);
        }

        const provider = this.providers.get(providerName);
        if (!provider) continue;

        const available = await this.checkProvider(providerName, provider);
        if (!available) continue;

        const model = this.resolveModelForProvider(providerName, request.model);
        const response = await provider.generate({ ...request, id: requestId, model });
        return response;
      } catch (error) {
        console.error(`[InferenceRouter] ${providerName} failed:`, error);
        continue; // Try next provider
      }
    }

    throw new Error('ALL_PROVIDERS_FAILED: No inference provider available');
  }

  async *generateStream(request: InferenceRequest): AsyncGenerator<InferenceStreamChunk> {
    const requestId = request.id || randomUUID();

    const chain = this.config.mode === 'auto'
      ? PROVIDER_CHAIN
      : [this.config.mode];

    for (const providerName of chain) {
      try {
        if (providerName === 'openrouter') {
          if (!this.openRouterKey) continue;
          yield* this.streamOpenRouter(request, requestId);
          return;
        }

        const provider = this.providers.get(providerName);
        if (!provider) continue;

        const available = await this.checkProvider(providerName, provider);
        if (!available) continue;

        const model = this.resolveModelForProvider(providerName, request.model);
        yield* provider.generateStream({ ...request, id: requestId, model });
        return;
      } catch (error) {
        console.error(`[InferenceRouter] ${providerName} stream failed:`, error);
        continue;
      }
    }

    throw new Error('ALL_PROVIDERS_STREAM_FAILED');
  }

  // Resolve model name for specific provider
  private resolveModelForProvider(provider: string, requestedModel?: string): string {
    if (provider === 'cloudflare') {
      if (!requestedModel) return CF_MODELS['llama-3.1-8b'];
      if (requestedModel.startsWith('@cf/')) return requestedModel;
      // Map generic names to CF models
      const cfMap: Record<string, string> = {
        'llama': CF_MODELS['llama-3.1-8b'],
        'qwen': CF_MODELS['qwen-1.5-14b'],
        'mistral': CF_MODELS['mistral-7b'],
        'deepseek': CF_MODELS['deepseek-math'],
        'coder': CF_MODELS['qwen-2.5-coder'],
        'phi': CF_MODELS['phi-2'],
      };
      for (const [key, model] of Object.entries(cfMap)) {
        if (requestedModel.toLowerCase().includes(key)) return model;
      }
      return CF_MODELS['llama-3.1-8b'];
    }

    if (provider === 'minimax') {
      return requestedModel ?? 'abab6.5s-chat';
    }

    if (provider === 'ollama') {
      return requestedModel ?? 'llama3.2:3b';
    }

    return requestedModel ?? this.config.preferredCloudModel;
  }

  private async generateOpenRouter(
    request: InferenceRequest,
    requestId: string,
    startTime: number
  ): Promise<InferenceResponse> {
    const model = request.model || this.config.preferredCloudModel;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vyrden.com',
        'X-Title': 'VYRDON AI Room',
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
          { role: 'user', content: request.prompt },
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`OPENROUTER_FAILED: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const durationMs = Date.now() - startTime;

    return {
      id: requestId,
      model: data.model,
      content: data.choices[0]?.message.content ?? '',
      text: data.choices[0]?.message.content ?? '',
      tokensUsed: data.usage?.total_tokens ?? 0,
      durationMs,
      timestamp: new Date().toISOString(),
      evidenceRef: `vyrden.inference.openrouter.${requestId}`,
    };
  }

  private async *streamOpenRouter(
    request: InferenceRequest,
    requestId: string
  ): AsyncGenerator<InferenceStreamChunk> {
    const model = request.model || this.config.preferredCloudModel;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vyrden.com',
        'X-Title': 'VYRDON AI Room',
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
          { role: 'user', content: request.prompt },
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OPENROUTER_STREAM_FAILED: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('OPENROUTER_NO_STREAM_BODY');
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
        const data = line.slice(6);
        if (data === '[DONE]') {
          yield { id: requestId, content: '', done: true };
          return;
        }

        const chunk = JSON.parse(data) as { choices: Array<{ delta?: { content?: string } }> };
        const content = chunk.choices[0]?.delta?.content ?? '';
        if (content) {
          yield { id: requestId, content, done: false };
        }
      }
    }
  }

  private async checkProvider(name: string, provider: InferenceProvider): Promise<boolean> {
    // Cache provider availability for 30 seconds
    const now = Date.now();
    if (now < this.cacheExpiry && this.providerCache.has(name)) {
      return this.providerCache.get(name)!;
    }

    const available = await provider.isAvailable();
    this.providerCache.set(name, available);
    this.cacheExpiry = now + 30000;
    return available;
  }

  async listAllModels(): Promise<Record<string, readonly ModelInfo[]>> {
    const result: Record<string, readonly ModelInfo[]> = {};
    for (const [name, provider] of this.providers) {
      try {
        result[name] = await provider.listModels();
      } catch {
        result[name] = [];
      }
    }
    return result;
  }

  async getStatus(): Promise<{
    mode: InferenceMode;
    ollamaAvailable: boolean;
    openRouterConfigured: boolean;
    cloudflareConfigured: boolean;
    minimaxConfigured: boolean;
    localModels: readonly ModelInfo[];
    activeProvider: string;
  }> {
    const statuses: Record<string, boolean> = {};
    for (const [name, provider] of this.providers) {
      statuses[name] = await provider.isAvailable();
    }

    const ollama = this.providers.get('ollama') as OllamaProvider;
    const localModels = statuses['ollama'] ? await ollama.listModels() : [];

    // Determine which provider would be used
    let activeProvider = 'none';
    for (const name of PROVIDER_CHAIN) {
      if (name === 'openrouter' && this.openRouterKey) { activeProvider = 'openrouter'; break; }
      if (statuses[name]) { activeProvider = name; break; }
    }

    return {
      mode: this.config.mode,
      ollamaAvailable: statuses['ollama'] ?? false,
      openRouterConfigured: !!this.openRouterKey,
      cloudflareConfigured: statuses['cloudflare'] ?? false,
      minimaxConfigured: statuses['minimax'] ?? false,
      localModels,
      activeProvider,
    };
  }

  setMode(mode: InferenceMode): void {
    this.config.mode = mode;
    this.providerCache.clear();
  }

  invalidateCache(): void {
    this.providerCache.clear();
    this.cacheExpiry = 0;
  }

  getProvider(name: string): InferenceProvider | undefined {
    return this.providers.get(name);
  }
}

// Singleton instance
let _router: InferenceRouter | null = null;

export function getInferenceRouter(config?: Partial<RouterConfig>): InferenceRouter {
  if (!_router) {
    _router = new InferenceRouter(config);
  }
  return _router;
}

export function resetInferenceRouter(): void {
  _router = null;
}
