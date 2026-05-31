// Cloudflare Workers AI Backend
// vyrden.com — Inference via Cloudflare Workers AI

export interface CloudflareWorkerConfig {
  accountId: string;
  apiToken: string;
  baseUrl: string;
}

export interface WorkerModel {
  name: string;
  type: 'text-generation' | 'embedding' | 'classification';
}

const MODELS: Record<string, WorkerModel> = {
  '@cf/meta/llama-2-7b-chat-int8': {
    name: 'Llama 2 7B Chat',
    type: 'text-generation',
  },
  '@cf/mistral/mistral-7b-instruct-v0.1': {
    name: 'Mistral 7B Instruct',
    type: 'text-generation',
  },
  '@cf/google/gemma-7b-it': {
    name: 'Google Gemma 7B',
    type: 'text-generation',
  },
  '@cf/baai/bge-base-en-v1.5': {
    name: 'BAAI BGE Embeddings',
    type: 'embedding',
  },
};

export class CloudflareWorkersAI {
  private config: CloudflareWorkerConfig;

  constructor(config: CloudflareWorkerConfig) {
    this.config = config;
  }

  async generate(prompt: string, modelId: string, options?: {
    maxTokens?: number;
    temperature?: number;
  }): Promise<string> {
    const url = `${this.config.baseUrl}/accounts/${this.config.accountId}/ai/run/${modelId}`;

    const body = {
      prompt,
      max_tokens: options?.maxTokens ?? 512,
      temperature: options?.temperature ?? 0.7,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare Workers AI error: ${response.statusText}`);
    }

    const result = await response.json() as { result?: { response?: string } };
    return result.result?.response ?? '';
  }

  async *generateStream(prompt: string, modelId: string, options?: {
    maxTokens?: number;
    temperature?: number;
  }): AsyncGenerator<{ token: string; done: boolean }> {
    const url = `${this.config.baseUrl}/accounts/${this.config.accountId}/ai/run/${modelId}`;

    const body = {
      prompt,
      max_tokens: options?.maxTokens ?? 512,
      temperature: options?.temperature ?? 0.7,
      stream: true,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare Workers AI stream error: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body from Cloudflare Workers AI');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        yield { token: '', done: true };
        break;
      }

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter(Boolean);

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6)) as { response?: string };
            if (data.response) {
              yield { token: data.response, done: false };
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    }
  }

  async embed(text: string, modelId: string = '@cf/baai/bge-base-en-v1.5'): Promise<number[]> {
    const url = `${this.config.baseUrl}/accounts/${this.config.accountId}/ai/run/${modelId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare Workers AI embed error: ${response.statusText}`);
    }

    const result = await response.json() as { result?: { shape?: number[]; data?: number[][] } };
    return result.result?.data?.[0] ?? [];
  }

  getAvailableModels(): WorkerModel[] {
    return Object.values(MODELS);
  }

  getModel(id: string): WorkerModel | undefined {
    return MODELS[id];
  }

  static fromEnv(): CloudflareWorkersAI {
    const accountId = process.env['CF_ACCOUNT_ID'];
    const apiToken = process.env['CF_API_TOKEN'];

    if (!accountId || !apiToken) {
      throw new Error('CF_ACCOUNT_ID and CF_API_TOKEN environment variables required');
    }

    return new CloudflareWorkersAI({
      accountId,
      apiToken,
      baseUrl: 'https://api.cloudflare.com/client/v4',
    });
  }
}

let instance: CloudflareWorkersAI | null = null;

export function getCloudflareWorkers(): CloudflareWorkersAI {
  if (!instance) {
    instance = CloudflareWorkersAI.fromEnv();
  }
  return instance;
}
