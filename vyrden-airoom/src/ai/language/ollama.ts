// VYRDON AI Room — Ollama Language Provider
// vyrden.com — Hidden Operations Center

import { randomUUID } from 'node:crypto';
import type {
  LanguageProvider,
  TranslationRequest,
  TranslationResult,
  LanguageDetectionRequest,
  LanguageDetectionResult,
  SentimentResult,
  EntityExtractionResult,
  ExtractedEntity,
  SummarizationRequest,
  SummarizationResult,
  LanguageCode,
} from './types.js';

interface OllamaGenerateResponse {
  response: string;
  done: boolean;
}

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', ru: 'Russian', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
  ar: 'Arabic', hi: 'Hindi', th: 'Thai', vi: 'Vietnamese', nl: 'Dutch',
  pl: 'Polish', tr: 'Turkish', uk: 'Ukrainian', cs: 'Czech', sv: 'Swedish',
};

export class OllamaLanguageProvider implements LanguageProvider {
  readonly name = 'ollama';
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl ?? process.env['OLLAMA_HOST'] ?? 'http://localhost:11434';
    this.model = model ?? process.env['OLLAMA_LANGUAGE_MODEL'] ?? 'llama3.2';
  }

  private async generate(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`OLLAMA_GENERATE_FAILED: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaGenerateResponse;
    return data.response.trim();
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const sourceLangName = request.sourceLang ? LANGUAGE_NAMES[request.sourceLang] : 'auto-detect';
    const targetLangName = LANGUAGE_NAMES[request.targetLang];

    const prompt = `Translate the following text from ${sourceLangName} to ${targetLangName}. Output ONLY the translation, nothing else.

Text: ${request.text}

Translation:`;

    const translatedText = await this.generate(prompt);

    // Detect source language if not provided
    let sourceLang = request.sourceLang;
    if (!sourceLang) {
      const detection = await this.detectLanguage({ id: randomUUID(), text: request.text });
      sourceLang = detection.detectedLang;
    }

    return {
      id: request.id,
      originalText: request.text,
      translatedText,
      sourceLang,
      targetLang: request.targetLang,
      confidence: 0.85,
      timestamp: new Date().toISOString(),
      evidenceRef: `vyrden.language.translate.${request.id}`,
    };
  }

  async detectLanguage(request: LanguageDetectionRequest): Promise<LanguageDetectionResult> {
    const langCodes = Object.keys(LANGUAGE_NAMES).join(', ');

    const prompt = `Detect the language of the following text. Respond with ONLY the two-letter language code from this list: ${langCodes}

Text: ${request.text}

Language code:`;

    const response = await this.generate(prompt);
    const detectedLang = (response.toLowerCase().slice(0, 2) as LanguageCode) || 'en';

    return {
      id: request.id,
      text: request.text,
      detectedLang,
      confidence: 0.9,
      alternatives: [],
      timestamp: new Date().toISOString(),
      evidenceRef: `vyrden.language.detect.${request.id}`,
    };
  }

  async analyzeSentiment(text: string): Promise<SentimentResult> {
    const id = randomUUID();

    const prompt = `Analyze the sentiment of the following text. Respond with ONLY one word: positive, negative, neutral, or mixed

Text: ${text}

Sentiment:`;

    const response = await this.generate(prompt);
    const sentimentRaw = response.toLowerCase().trim();
    const sentiment = ['positive', 'negative', 'neutral', 'mixed'].includes(sentimentRaw)
      ? (sentimentRaw as 'positive' | 'negative' | 'neutral' | 'mixed')
      : 'neutral';

    const scoreMap: Record<string, number> = {
      positive: 0.7,
      negative: -0.7,
      neutral: 0,
      mixed: 0.1,
    };

    return {
      id,
      text,
      sentiment,
      score: scoreMap[sentiment] ?? 0,
      confidence: 0.85,
      timestamp: new Date().toISOString(),
      evidenceRef: `vyrden.language.sentiment.${id}`,
    };
  }

  async extractEntities(text: string): Promise<EntityExtractionResult> {
    const id = randomUUID();

    const prompt = `Extract named entities from the following text. For each entity, provide: text, type (person/organization/location/date/money/time/product/event/other), and character positions.

Format each entity as: "entity_text|type|start_index|end_index"
One entity per line. If no entities found, respond with "NONE".

Text: ${text}

Entities:`;

    const response = await this.generate(prompt);
    const entities: ExtractedEntity[] = [];

    if (response.trim().toUpperCase() !== 'NONE') {
      const lines = response.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 4) {
          const [entityText, typeRaw, startRaw, endRaw] = parts;
          const validTypes = ['person', 'organization', 'location', 'date', 'money', 'percent', 'time', 'product', 'event', 'other'];
          const type = validTypes.includes(typeRaw?.toLowerCase() ?? '') ? typeRaw?.toLowerCase() as ExtractedEntity['type'] : 'other';

          entities.push({
            text: entityText ?? '',
            type,
            startIndex: parseInt(startRaw ?? '0', 10),
            endIndex: parseInt(endRaw ?? '0', 10),
            confidence: 0.8,
          });
        }
      }
    }

    return {
      id,
      text,
      entities,
      timestamp: new Date().toISOString(),
      evidenceRef: `vyrden.language.entities.${id}`,
    };
  }

  async summarize(request: SummarizationRequest): Promise<SummarizationResult> {
    const maxLength = request.maxLength ?? 150;
    const style = request.style ?? 'paragraph';

    let styleInstruction = '';
    switch (style) {
      case 'bullet':
        styleInstruction = 'Use bullet points.';
        break;
      case 'headline':
        styleInstruction = 'Write a single headline sentence.';
        break;
      default:
        styleInstruction = 'Write a concise paragraph.';
    }

    const prompt = `Summarize the following text in approximately ${maxLength} characters or less. ${styleInstruction}

Text: ${request.text}

Summary:`;

    const summary = await this.generate(prompt);
    const compressionRatio = summary.length / request.text.length;

    return {
      id: request.id,
      originalText: request.text,
      summary,
      compressionRatio,
      timestamp: new Date().toISOString(),
      evidenceRef: `vyrden.language.summarize.${request.id}`,
    };
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
