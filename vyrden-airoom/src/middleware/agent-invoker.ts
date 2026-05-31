// Agent Invoker — Direct agent invocation endpoint
// vyrden.com — /api/agent/:id/invoke

import { agentRegistry } from '../agents/registry.js';
import { getCloudflareWorkers } from '../ai/cloudflare-workers.js';
import { getInferenceRouter } from '../ai/inference/router.js';
import type { AgentId } from '../core/types.js';

export interface InvokeRequest {
  prompt: string;
  context?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  useCloudflare?: boolean;
}

export interface InvokeResponse {
  agentId: AgentId;
  agentName: string;
  status: 'success' | 'error';
  result?: string;
  error?: string;
  duration: number;
  model?: string;
  timestamp: string;
}

export class AgentInvoker {
  async invoke(agentId: AgentId, request: InvokeRequest): Promise<InvokeResponse> {
    const startTime = Date.now();
    const agent = agentRegistry.get(agentId);

    if (!agent) {
      return {
        agentId,
        agentName: 'Unknown',
        status: 'error',
        error: `Agent ${agentId} not found`,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      let result: string;
      let model: string;

      // Use Cloudflare Workers AI if requested
      if (request.useCloudflare) {
        try {
          const cf = getCloudflareWorkers();
          model = '@cf/mistral/mistral-7b-instruct-v0.1';
          result = await cf.generate(request.prompt, model, {
            maxTokens: request.maxTokens ?? 512,
            temperature: request.temperature ?? 0.7,
          });
        } catch (_cfError) {
          // Fallback to local inference
          const router = getInferenceRouter();
          const response = await router.generate({
            prompt: request.prompt,
            maxTokens: request.maxTokens,
            temperature: request.temperature,
          });
          result = response.response ?? '';
          model = response.model ?? 'fallback';
        }
      } else {
        // Use local/cloud inference router (Ollama/OpenRouter)
        const router = getInferenceRouter();
        const response = await router.generate({
          prompt: request.prompt,
          maxTokens: request.maxTokens,
          temperature: request.temperature,
        });
        result = response.response ?? '';
        model = response.model ?? 'unknown';
      }

      return {
        agentId,
        agentName: agent.name,
        status: 'success',
        result,
        duration: Date.now() - startTime,
        model,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        agentId,
        agentName: agent.name,
        status: 'error',
        error: errorMsg,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async *invokeStream(
    agentId: AgentId,
    request: InvokeRequest
  ): AsyncGenerator<{ chunk: string; done: boolean }> {
    const agent = agentRegistry.get(agentId);

    if (!agent) {
      yield { chunk: JSON.stringify({ error: `Agent ${agentId} not found` }), done: true };
      return;
    }

    try {
      if (request.useCloudflare) {
        const cf = getCloudflareWorkers();
        const model = '@cf/mistral/mistral-7b-instruct-v0.1';
        for await (const chunk of cf.generateStream(request.prompt, model, {
          maxTokens: request.maxTokens ?? 512,
          temperature: request.temperature ?? 0.7,
        })) {
          yield {
            chunk: chunk.token,
              done: chunk.done,
          };
        }
      } else {
        const router = getInferenceRouter();
        for await (const chunk of router.generateStream({
          prompt: request.prompt,
          maxTokens: request.maxTokens,
          temperature: request.temperature,
        })) {
          yield {
            chunk: chunk.text ?? '',
              done: chunk.done ?? false,
          };
        }
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      yield { chunk: JSON.stringify({ error: errorMsg }), done: true };
    }
  }

  getAgent(agentId: AgentId) {
    return agentRegistry.get(agentId);
  }

  getAllAgents() {
    return agentRegistry.getAll();
  }

  hasCapability(agentId: AgentId, capability: string): boolean {
    return agentRegistry.hasCapability(agentId, capability);
  }
}

export const agentInvoker = new AgentInvoker();
