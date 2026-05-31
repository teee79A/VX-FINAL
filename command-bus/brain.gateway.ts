// Lazy import breaks circular: SZH_CENTRAL_BRAIN → ENGINES → command-bus → brain.gateway → SZH_CENTRAL_BRAIN
let _brainRuntime: import("../SZH_CENTRAL_BRAIN/index.js").CentralBrainRuntime | null = null;
async function getBrainRuntime() {
  if (!_brainRuntime) {
    const mod = await import("../SZH_CENTRAL_BRAIN/index.js");
    _brainRuntime = mod.centralBrainRuntime;
  }
  return _brainRuntime;
}
import { BrainProvider, SafeCommand } from "./command.types.js";

interface BrainProviderConfig {
  kind: "vllm" | "openrouter";
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export interface BrainGatewayResult {
  provider: BrainProvider;
  outputPreview: string;
  externalRequestId?: string;
  evidenceRef: string;
}

export class BrainGateway {
  private readonly timeoutMs: number;

  constructor() {
    const raw = Number(process.env.BRAIN_TIMEOUT_MS ?? 20000);
    this.timeoutMs = Number.isFinite(raw) && raw > 0 ? raw : 20000;
  }

  async run(command: SafeCommand): Promise<BrainGatewayResult> {
    if (!command.target.startsWith("vxstation.brain.")) {
      throw new Error("BRAIN_GATEWAY_TARGET_MISMATCH");
    }

    if (command.target === "vxstation.brain.health") {
      const brain = await getBrainRuntime();
      const health = await brain.health();
      return {
        provider: health.provider,
        outputPreview: health.outputPreview,
        evidenceRef: health.evidenceRef,
      };
    }

    const brain = await getBrainRuntime();
    const dispatchOpts: Parameters<typeof brain.dispatch>[0] = {
      target: command.target,
      payload: command.payload,
      caller: command.source,
    };
    if (command.command_id) dispatchOpts.requestId = command.command_id;
    if (command.issued_at) dispatchOpts.issuedAt = command.issued_at;
    const local = await brain.dispatch(dispatchOpts);
    if (local && !this.shouldPreferExternalInference(command)) {
      return local;
    }

    const prompt = this.resolvePrompt(command);
    const config = this.resolveProvider();
    if (!config) {
      if (local) {
        return local;
      }
      throw new Error("BRAIN_PROVIDER_UNCONFIGURED");
    }
    if (!prompt) {
      if (local) {
        return local;
      }
      throw new Error("BRAIN_PROMPT_REQUIRED");
    }

    const response = await this.callOpenAiCompatible(config, prompt, command.payload);
    const evidenceRef = `kitty.brain.${config.kind}.${Date.now()}`;

    const result: BrainGatewayResult = {
      provider: config.kind,
      outputPreview: response.output.slice(0, 280),
      evidenceRef,
    };
    if (response.requestId) {
      result.externalRequestId = response.requestId;
    }
    return result;
  }

  private shouldPreferExternalInference(command: SafeCommand): boolean {
    const target = command.target.slice("vxstation.brain.".length);
    if (target !== "infer" && target !== "claude_code_logic_brain") {
      return false;
    }
    return this.resolvePrompt(command).length > 0;
  }

  private resolveProvider(): BrainProviderConfig | null {
    const priority = (process.env.BRAIN_PROVIDER_PRIORITY ?? "vllm,openrouter")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    for (const provider of priority) {
      if (provider === "vllm") {
        const baseUrl = process.env.VLLM_BASE_URL?.trim();
        if (!baseUrl) {
          continue;
        }
        const apiKey = process.env.VLLM_API_KEY?.trim();
        return {
          kind: "vllm" as const,
          baseUrl,
          model: process.env.VLLM_MODEL?.trim() || "Qwen/Qwen3-0.6B",
          ...(apiKey ? { apiKey } : {}),
        };
      }

      if (provider === "openrouter") {
        const apiKey = process.env.OPENROUTER_API_KEY?.trim();
        if (!apiKey) {
          continue;
        }
        return {
          kind: "openrouter",
          baseUrl: process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1",
          model: process.env.OPENROUTER_MODEL?.trim() || "anthropic/claude-sonnet-4.6",
          apiKey,
        };
      }
    }

    return null;
  }

  private resolvePrompt(command: SafeCommand): string {
    const payload = command.payload as Record<string, unknown>;
    const prompt =
      (typeof payload.prompt === "string" && payload.prompt) ||
      (typeof payload.query === "string" && payload.query) ||
      "";
    return prompt.trim();
  }

  private async callOpenAiCompatible(
    config: BrainProviderConfig,
    prompt: string,
    payload: Record<string, unknown>,
  ): Promise<{ output: string; requestId?: string }> {
    const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const maxTokens = typeof payload.maxTokens === "number" ? payload.maxTokens : 256;
      const temperature = typeof payload.temperature === "number" ? payload.temperature : 0.2;
      const systemMessage =
        typeof payload.system === "string" ? payload.system : "You are Kitty Brain.";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (config.apiKey) {
        headers.Authorization = `Bearer ${config.apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: config.model,
          max_tokens: maxTokens,
          temperature,
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: prompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`BRAIN_UPSTREAM_HTTP_${response.status}`);
      }

      const data = (await response.json()) as {
        id?: string;
        choices?: Array<{
          message?: { content?: unknown };
        }>;
      };

      const content = data.choices?.[0]?.message?.content;
      const text = this.normalizeContent(content);
      if (!text) {
        throw new Error("BRAIN_EMPTY_RESPONSE");
      }

      const result: { output: string; requestId?: string } = { output: text };
      if (data.id) result.requestId = data.id;
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  private normalizeContent(content: unknown): string {
    if (typeof content === "string") {
      return content.trim();
    }
    if (Array.isArray(content)) {
      const combined = content
        .map((item) => {
          if (
            item &&
            typeof item === "object" &&
            "text" in item &&
            typeof (item as { text?: unknown }).text === "string"
          ) {
            return ((item as { text: string }).text || "").trim();
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");
      return combined.trim();
    }
    return "";
  }
}
