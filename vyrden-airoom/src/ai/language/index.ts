// VYRDON AI Room — Language Engine Manager
// vyrden.com — Hidden Operations Center

import { randomUUID } from 'node:crypto';
import { OllamaLanguageProvider } from './ollama.js';
import type {
  LanguageProvider,
  TranslationRequest,
  TranslationResult,
  LanguageDetectionResult,
  SentimentResult,
  EntityExtractionResult,
  SummarizationRequest,
  SummarizationResult,
  LanguageCode,
} from './types.js';

export type {
  LanguageCode,
  TranslationRequest,
  TranslationResult,
  LanguageDetectionResult,
  SentimentResult,
  EntityExtractionResult,
  ExtractedEntity,
  SummarizationRequest,
  SummarizationResult,
  LanguageProvider,
} from './types.js';

export { OllamaLanguageProvider };

export class LanguageManager {
  private readonly providers: Map<string, LanguageProvider>;
  private defaultProvider: string;

  constructor() {
    this.providers = new Map();
    this.defaultProvider = 'ollama';

    // Register default providers
    this.providers.set('ollama', new OllamaLanguageProvider());
  }

  registerProvider(provider: LanguageProvider): void {
    this.providers.set(provider.name, provider);
  }

  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`LANGUAGE_PROVIDER_NOT_FOUND: ${name}`);
    }
    this.defaultProvider = name;
  }

  private getProvider(name?: string): LanguageProvider {
    const providerName = name ?? this.defaultProvider;
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`LANGUAGE_PROVIDER_NOT_FOUND: ${providerName}`);
    }
    return provider;
  }

  async translate(
    text: string,
    targetLang: LanguageCode,
    sourceLang?: LanguageCode,
    provider?: string,
  ): Promise<TranslationResult> {
    const p = this.getProvider(provider);
    const request: TranslationRequest = {
      id: randomUUID(),
      text,
      targetLang,
    };
    if (sourceLang !== undefined) {
      request.sourceLang = sourceLang;
    }
    return p.translate(request);
  }

  async detectLanguage(text: string, provider?: string): Promise<LanguageDetectionResult> {
    const p = this.getProvider(provider);
    return p.detectLanguage({
      id: randomUUID(),
      text,
    });
  }

  async analyzeSentiment(text: string, provider?: string): Promise<SentimentResult> {
    const p = this.getProvider(provider);
    return p.analyzeSentiment(text);
  }

  async extractEntities(text: string, provider?: string): Promise<EntityExtractionResult> {
    const p = this.getProvider(provider);
    return p.extractEntities(text);
  }

  async summarize(
    text: string,
    maxLength?: number,
    style?: 'bullet' | 'paragraph' | 'headline',
    provider?: string,
  ): Promise<SummarizationResult> {
    const p = this.getProvider(provider);
    const request: SummarizationRequest = {
      id: randomUUID(),
      text,
    };
    if (maxLength !== undefined) {
      request.maxLength = maxLength;
    }
    if (style !== undefined) {
      request.style = style;
    }
    return p.summarize(request);
  }

  async checkHealth(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const [name, provider] of this.providers) {
      results[name] = await provider.isAvailable();
    }
    return results;
  }
}

// Singleton instance
export const languageManager = new LanguageManager();
