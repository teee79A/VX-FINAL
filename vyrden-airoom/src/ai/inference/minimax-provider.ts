// VYRDON AI Room — MiniMax API Provider
// Secondary inference backend — MiniMax cloud models
// vyrden.com — Hidden Operations Center

import { randomUUID } from 'node:crypto';
import type {
  InferenceProvider,
  InferenceRequest,
  InferenceResponse,
  InferenceStreamChunk,
  ModelInfo,
} from './types.js';

const MINIMAX_MODELS = {
  'abab6.5s': 'abab6.5s-chat',
  'abab6.5': 'abab6.5-chat',
  'abab5.5s': 'abab5.5s-chat',
  'abab5.5': 'abab5.5-chat',
} as const;

const DEFAULT_MODEL = 'abab6.5s-chat';

export class MiniMaxProvider implements InferenceProvider {
  readonly name = 'minimax';
  private readonly apiKey: string;
  private readonly groupId: string;
  private readonly baseUrl: string;

  constructor(apiKey?: string, groupId?: string) {
    this.apiKey = apiKey ?? process.env['MINIMAX_API_KEY'] ?? '';
    this.groupId = groupId ?? process.env['MINIMAX_GROUP_ID'] ?? '';
    this.baseUrl = 'https://api.minimax.chat/v1';
  }

  private resolveModel(model?: string): string {
    if (!model) return DEFAULT_MODEL;
    if (model in MINIMAX_MODELS) return MINIMAX_MODELS[model as keyof typeof MINIMAX_MODELS];
    if (model.startsWith('abab')) return model;
    return DEFAULT_MODEL;
  }

  async generate(request: InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now();
    const requestId = request.id || randomUUID();
    const model = this.resolveModel(request.model);

    const messages: Array<{ sender_type: string; sender_name: string; text: string }> = [];
    if (request.systemPrompt) {
      // MiniMax uses bot_setting for system prompt
    }
    messages.push({ sender_type: 'USER', sender_name: 'VYRDON', text: request.prompt });

    const url = `${this.baseUrl}/text/chatcompletion_v2?GroupId=${this.groupId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
          { role: 'user', content: request.prompt },
        ],
        temperature: request.temperature ?? 0.7,
        tokens_to_generate: request.maxTokens ?? 2048,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`MINIMAX_FAILED: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content: string } }>;
      usage?: { total_tokens: number };
      base_resp?: { status_code: number; status_msg: string };
    };

    if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
      throw new Error(`MINIMAX_ERROR: ${data.base_resp.status_msg}`);
    }

    const content = data.choices?.[0]?.message?.content ?? '';
    const durationMs = Date.now() - startTime;

    return {
      id: requestId,
      model,
      content,
      text: content,
      tokensUsed: data.usage?.total_tokens ?? Math.ceil(content.length / 4),
      durationMs,
      timestamp: new Date().toISOString(),
      evidenceRef: `vyrden.inference.minimax.${requestId}`,
    };
  }

  async *generateStream(request: InferenceRequest): AsyncGenerator<InferenceStreamChunk> {
    const requestId = request.id || randomUUID();
    const model = this.resolveModel(request.model);

    const url = `${this.baseUrl}/text/chatcompletion_v2?GroupId=${this.groupId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
          { role: 'user', content: request.prompt },
        ],
        temperature: request.temperature ?? 0.7,
        tokens_to_generate: request.maxTokens ?? 2048,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`MINIMAX_STREAM_FAILED: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('MINIMAX_NO_STREAM_BODY');
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
          const chunk = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const content = chunk.choices?.[0]?.delta?.content ?? '';
          if (content) {
            yield { id: requestId, content, done: false };
          }
        } catch {
          // Skip malformed
        }
      }
    }

    yield { id: requestId, content: '', done: true };
  }

  async listModels(): Promise<readonly ModelInfo[]> {
    return Object.entries(MINIMAX_MODELS).map(([alias, id]) => ({
      name: `${alias} (${id})`,
      size: 'cloud',
      quantization: 'none',
      parameters: alias,
      available: !!this.apiKey,
    }));
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && !!this.groupId;
  }
}
