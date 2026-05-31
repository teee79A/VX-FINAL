// VYRDON AI Room — Language Engine Types
// vyrden.com — Hidden Operations Center

export type LanguageCode =
  | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'zh' | 'ja' | 'ko'
  | 'ar' | 'hi' | 'th' | 'vi' | 'nl' | 'pl' | 'tr' | 'uk' | 'cs' | 'sv';

export interface TranslationRequest {
  id: string;
  text: string;
  sourceLang?: LanguageCode;
  targetLang: LanguageCode;
  context?: string;
}

export interface TranslationResult {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  confidence: number;
  timestamp: string;
  evidenceRef: string;
}

export interface LanguageDetectionRequest {
  id: string;
  text: string;
}

export interface LanguageDetectionResult {
  id: string;
  text: string;
  detectedLang: LanguageCode;
  confidence: number;
  alternatives: readonly { lang: LanguageCode; confidence: number }[];
  timestamp: string;
  evidenceRef: string;
}

export interface SentimentResult {
  id: string;
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  score: number; // -1 to 1
  confidence: number;
  timestamp: string;
  evidenceRef: string;
}

export interface EntityExtractionResult {
  id: string;
  text: string;
  entities: readonly ExtractedEntity[];
  timestamp: string;
  evidenceRef: string;
}

export interface ExtractedEntity {
  text: string;
  type: 'person' | 'organization' | 'location' | 'date' | 'money' | 'percent' | 'time' | 'product' | 'event' | 'other';
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export interface SummarizationRequest {
  id: string;
  text: string;
  maxLength?: number;
  style?: 'bullet' | 'paragraph' | 'headline';
}

export interface SummarizationResult {
  id: string;
  originalText: string;
  summary: string;
  compressionRatio: number;
  timestamp: string;
  evidenceRef: string;
}

export interface LanguageProvider {
  readonly name: string;
  translate(request: TranslationRequest): Promise<TranslationResult>;
  detectLanguage(request: LanguageDetectionRequest): Promise<LanguageDetectionResult>;
  analyzeSentiment(text: string): Promise<SentimentResult>;
  extractEntities(text: string): Promise<EntityExtractionResult>;
  summarize(request: SummarizationRequest): Promise<SummarizationResult>;
  isAvailable(): Promise<boolean>;
}
