// VYRDON AI Room — Inference Manager
// vyrden.com — Hidden Operations Center

import { OllamaProvider } from './ollama.js';
import { CloudflareProvider } from './cloudflare-provider.js';
import { MiniMaxProvider } from './minimax-provider.js';
import {
  InferenceRouter,
  getInferenceRouter,
  resetInferenceRouter,
  type InferenceMode,
  type RouterConfig,
} from './router.js';
import type {
  InferenceProvider,
  InferenceRequest,
  InferenceResponse,
  InferenceStreamChunk,
  ModelInfo,
} from './types.js';

export { OllamaProvider, CloudflareProvider, MiniMaxProvider, InferenceRouter, getInferenceRouter, resetInferenceRouter };
export type { InferenceProvider, InferenceRequest, InferenceResponse, InferenceStreamChunk as StreamChunk, ModelInfo, InferenceMode, RouterConfig };

export class InferenceManager {
  private readonly providers: Map<string, InferenceProvider>;
  private defaultProvider: string;

  constructor() {
    this.providers = new Map();
    this.defaultProvider = 'cloudflare';

    // Register all providers — Cloudflare is primary
    this.providers.set('cloudflare', new CloudflareProvider());
    this.providers.set('minimax', new MiniMaxProvider());
    this.providers.set('ollama', new OllamaProvider());
  }

  registerProvider(provider: InferenceProvider): void {
    this.providers.set(provider.name, provider);
  }

  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`INFERENCE_PROVIDER_NOT_FOUND: ${name}`);
    }
    this.defaultProvider = name;
  }

  private getProvider(name?: string): InferenceProvider {
    const providerName = name ?? this.defaultProvider;
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`INFERENCE_PROVIDER_NOT_FOUND: ${providerName}`);
    }
    return provider;
  }

  async generate(request: InferenceRequest, provider?: string): Promise<InferenceResponse> {
    return this.getProvider(provider).generate(request);
  }

  generateStream(request: InferenceRequest, provider?: string): AsyncGenerator<InferenceStreamChunk> {
    return this.getProvider(provider).generateStream(request);
  }

  async listModels(provider?: string): Promise<readonly ModelInfo[]> {
    return this.getProvider(provider).listModels();
  }

  async checkHealth(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const [name, provider] of this.providers) {
      results[name] = await provider.isAvailable();
    }
    return results;
  }

  getProviderNames(): readonly string[] {
    return Array.from(this.providers.keys());
  }
}

// Singleton instance
export const inferenceManager = new InferenceManager();
