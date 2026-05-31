// VYRDON Model Configuration
// Maps AI models across providers: Local (Ollama), Cloud (OpenRouter), and APIs

export interface ModelConfig {
  id: string;
  provider: 'ollama' | 'openrouter' | 'minimax' | 'deepseek' | 'qwen';
  name: string;
  contextWindow: number;
  costPer1kTokens: number;
  capabilities: string[];
  active: boolean;
}

export const VYRDON_MODELS: Record<string, ModelConfig> = {
  // ── Local Models (Ollama) ──
  'llama3.2:3b': {
    id: 'llama3.2:3b',
    provider: 'ollama',
    name: 'Meta Llama 3.2 3B',
    contextWindow: 8192,
    costPer1kTokens: 0,
    capabilities: ['reasoning', 'generation', 'coding'],
    active: true,
  },

  'llama3.2:7b': {
    id: 'llama3.2:7b',
    provider: 'ollama',
    name: 'Meta Llama 3.2 7B',
    contextWindow: 8192,
    costPer1kTokens: 0,
    capabilities: ['reasoning', 'generation', 'coding', 'analysis'],
    active: true,
  },

  'deepseek-coder:6.7b': {
    id: 'deepseek-coder:6.7b',
    provider: 'deepseek',
    name: 'Deepseek Coder 6.7B',
    contextWindow: 4096,
    costPer1kTokens: 0,
    capabilities: ['coding', 'generation', 'analysis'],
    active: true,
  },

  'deepseek-coder:33b': {
    id: 'deepseek-coder:33b',
    provider: 'deepseek',
    name: 'Deepseek Coder 33B',
    contextWindow: 4096,
    costPer1kTokens: 0,
    capabilities: ['coding', 'generation', 'analysis', 'math'],
    active: true,
  },

  'qwen:7b': {
    id: 'qwen:7b',
    provider: 'qwen',
    name: 'Alibaba Qwen 7B',
    contextWindow: 32768,
    costPer1kTokens: 0,
    capabilities: ['reasoning', 'generation', 'multilingual'],
    active: true,
  },

  'qwen:14b': {
    id: 'qwen:14b',
    provider: 'qwen',
    name: 'Alibaba Qwen 14B',
    contextWindow: 32768,
    costPer1kTokens: 0,
    capabilities: ['reasoning', 'generation', 'multilingual', 'analysis'],
    active: true,
  },

  'mistral:7b': {
    id: 'mistral:7b',
    provider: 'ollama',
    name: 'Mistral 7B (MiniMax Compatible)',
    contextWindow: 32768,
    costPer1kTokens: 0,
    capabilities: ['reasoning', 'generation', 'coding'],
    active: true,
  },

  'neural-chat:7b': {
    id: 'neural-chat:7b',
    provider: 'ollama',
    name: 'Neural Chat 7B (Optimized)',
    contextWindow: 8192,
    costPer1kTokens: 0,
    capabilities: ['conversation', 'generation', 'instruction-following'],
    active: true,
  },

  // ── Cloud Models (OpenRouter) ──
  'meta-llama/llama-3.1-405b-instruct': {
    id: 'meta-llama/llama-3.1-405b-instruct',
    provider: 'openrouter',
    name: 'Meta Llama 3.1 405B Instruct',
    contextWindow: 131072,
    costPer1kTokens: 0.018, // Approximate
    capabilities: ['reasoning', 'generation', 'analysis', 'math'],
    active: true,
  },

  'meta-llama/llama-3.1-70b-instruct': {
    id: 'meta-llama/llama-3.1-70b-instruct',
    provider: 'openrouter',
    name: 'Meta Llama 3.1 70B Instruct',
    contextWindow: 131072,
    costPer1kTokens: 0.0081,
    capabilities: ['reasoning', 'generation', 'analysis'],
    active: true,
  },

  'deepseek/deepseek-chat': {
    id: 'deepseek/deepseek-chat',
    provider: 'openrouter',
    name: 'Deepseek Chat (Cloud)',
    contextWindow: 4096,
    costPer1kTokens: 0.0014,
    capabilities: ['reasoning', 'generation', 'coding'],
    active: true,
  },

  'qwen/qwen-110b-chat': {
    id: 'qwen/qwen-110b-chat',
    provider: 'openrouter',
    name: 'Qwen 110B Chat (Cloud)',
    contextWindow: 32768,
    costPer1kTokens: 0.008,
    capabilities: ['reasoning', 'generation', 'multilingual'],
    active: true,
  },

  'mistralai/mistral-large': {
    id: 'mistralai/mistral-large',
    provider: 'openrouter',
    name: 'Mistral Large (Cloud)',
    contextWindow: 32768,
    costPer1kTokens: 0.008,
    capabilities: ['reasoning', 'generation', 'coding'],
    active: true,
  },
};

// Model selection strategies
export const MODEL_STRATEGIES = {
  // For coding tasks - prefer Deepseek
  coding: ['deepseek-coder:33b', 'deepseek-coder:6.7b', 'mistral:7b'],

  // For reasoning/analysis - prefer larger models
  reasoning: ['qwen:14b', 'meta-llama/llama-3.1-70b-instruct', 'llama3.2:7b'],

  // For quick responses - prefer smaller, faster models
  fast: ['llama3.2:3b', 'neural-chat:7b', 'mistral:7b'],

  // For multilingual - prefer Qwen
  multilingual: ['qwen:14b', 'qwen/qwen-110b-chat', 'qwen:7b'],

  // For high-context tasks (>10k tokens)
  highContext: ['qwen:14b', 'mistral:7b', 'meta-llama/llama-3.1-70b-instruct'],

  // Fallback chain (try in order)
  fallback: [
    'llama3.2:7b',
    'llama3.2:3b',
    'meta-llama/llama-3.1-70b-instruct',
    'mistralai/mistral-large',
  ],
};

// Provider configuration
export const PROVIDER_CONFIG = {
  ollama: {
    baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
    timeout: 300000, // 5 minutes
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY,
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    apiKey: process.env.ALIYUN_API_KEY,
  },
  minimax: {
    baseUrl: 'https://api.minimax.chat/v1',
    apiKey: process.env.MINIMAX_API_KEY,
  },
};

// Export helper functions
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return VYRDON_MODELS[modelId];
}

export function selectModelForTask(
  task: 'coding' | 'reasoning' | 'fast' | 'multilingual' | 'highContext'
): string {
  const strategy = MODEL_STRATEGIES[task] || MODEL_STRATEGIES.fallback;
  return strategy[0];
}

export function getAllActiveModels(): ModelConfig[] {
  return Object.values(VYRDON_MODELS).filter((m) => m.active);
}
