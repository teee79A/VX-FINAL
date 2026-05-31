// VYRDON AI Room — Tool Guard Sandbox
// vyrden.com — Hidden Operations Center

import type { AgentId } from '../../core/types.js';
import type {
  ToolDefinition,
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolPolicy,
  ToolPermission,
  ToolGuardConfig,
  RateLimit,
} from './types.js';

interface RateLimitState {
  count: number;
  windowStart: number;
}

export class ToolGuard {
  private readonly tools: Map<string, ToolDefinition>;
  private readonly policies: Map<string, ToolPolicy>;
  private readonly rateLimits: Map<string, RateLimitState>;
  private readonly executionLog: ToolExecutionResult[];
  private readonly config: ToolGuardConfig;

  constructor(config: Partial<ToolGuardConfig> = {}) {
    this.tools = new Map();
    this.policies = new Map();
    this.rateLimits = new Map();
    this.executionLog = [];
    this.config = {
      defaultPermission: config.defaultPermission ?? 'deny',
      maxExecutionTimeMs: config.maxExecutionTimeMs ?? 30000,
      enableSandbox: config.enableSandbox ?? true,
      logAllExecutions: config.logAllExecutions ?? true,
    };
  }

  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  unregisterTool(toolId: string): boolean {
    return this.tools.delete(toolId);
  }

  getTool(toolId: string): ToolDefinition | null {
    return this.tools.get(toolId) ?? null;
  }

  listTools(): readonly ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  setPolicy(policy: ToolPolicy): void {
    const key = `${policy.agentId}:${policy.toolId}`;
    this.policies.set(key, policy);
  }

  removePolicy(agentId: AgentId, toolId: string): boolean {
    const key = `${agentId}:${toolId}`;
    return this.policies.delete(key);
  }

  getPermission(agentId: AgentId, toolId: string): ToolPermission {
    const key = `${agentId}:${toolId}`;
    const policy = this.policies.get(key);

    if (policy) {
      if (this.evaluateConditions(policy, agentId, toolId)) {
        return policy.permission;
      }
    }

    // Check wildcard policy
    const wildcardKey = `${agentId}:*`;
    const wildcardPolicy = this.policies.get(wildcardKey);
    if (wildcardPolicy) {
      return wildcardPolicy.permission;
    }

    return this.config.defaultPermission;
  }

  private evaluateConditions(policy: ToolPolicy, _agentId: AgentId, _toolId: string): boolean {
    if (!policy.conditions || policy.conditions.length === 0) {
      return true;
    }

    for (const condition of policy.conditions) {
      switch (condition.type) {
        case 'time_range': {
          const now = new Date();
          const hour = now.getHours();
          const startHour = (condition.config['startHour'] as number) ?? 0;
          const endHour = (condition.config['endHour'] as number) ?? 24;
          if (hour < startHour || hour >= endHour) return false;
          break;
        }
        case 'rate_limit': {
          // Rate limit checked separately
          break;
        }
      }
    }

    return true;
  }

  private checkRateLimit(agentId: AgentId, toolId: string, limit?: RateLimit): boolean {
    if (!limit) return true;

    const key = `${agentId}:${toolId}`;
    const now = Date.now();
    const state = this.rateLimits.get(key);

    if (!state || now - state.windowStart >= limit.windowMs) {
      this.rateLimits.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (state.count >= limit.maxCalls) {
      return false;
    }

    state.count++;
    return true;
  }

  validateParameters(tool: ToolDefinition, params: Record<string, unknown>): string | null {
    for (const param of tool.parameters) {
      const value = params[param.name];

      if (param.required && value === undefined) {
        return `MISSING_REQUIRED_PARAMETER: ${param.name}`;
      }

      if (value !== undefined && param.validation) {
        const v = param.validation;

        if (param.type === 'string' && typeof value === 'string') {
          if (v.minLength !== undefined && value.length < v.minLength) {
            return `PARAMETER_TOO_SHORT: ${param.name}`;
          }
          if (v.maxLength !== undefined && value.length > v.maxLength) {
            return `PARAMETER_TOO_LONG: ${param.name}`;
          }
          if (v.pattern && !new RegExp(v.pattern).test(value)) {
            return `PARAMETER_PATTERN_MISMATCH: ${param.name}`;
          }
          if (v.enum && !v.enum.includes(value)) {
            return `PARAMETER_NOT_IN_ENUM: ${param.name}`;
          }
        }

        if (param.type === 'number' && typeof value === 'number') {
          if (v.min !== undefined && value < v.min) {
            return `PARAMETER_BELOW_MIN: ${param.name}`;
          }
          if (v.max !== undefined && value > v.max) {
            return `PARAMETER_ABOVE_MAX: ${param.name}`;
          }
        }
      }
    }

    return null;
  }

  async execute(
    request: ToolExecutionRequest,
    handler: (params: Record<string, unknown>) => Promise<unknown>,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const tool = this.tools.get(request.toolId);

    // Tool not found
    if (!tool) {
      return this.createFailureResult(request, 'TOOL_NOT_FOUND', startTime);
    }

    // Check permission
    const permission = this.getPermission(request.agentId, request.toolId);
    if (permission === 'deny') {
      return this.createFailureResult(request, 'PERMISSION_DENIED', startTime);
    }

    // Check rate limit
    if (!this.checkRateLimit(request.agentId, request.toolId, tool.rateLimit)) {
      return this.createFailureResult(request, 'RATE_LIMIT_EXCEEDED', startTime);
    }

    // Validate parameters
    const validationError = this.validateParameters(tool, request.parameters);
    if (validationError) {
      return this.createFailureResult(request, validationError, startTime);
    }

    // Execute with timeout
    const timeout = tool.timeout ?? this.config.maxExecutionTimeMs;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('EXECUTION_TIMEOUT')), timeout);
      });

      const output = await Promise.race([
        handler(request.parameters),
        timeoutPromise,
      ]);

      const result: ToolExecutionResult = {
        requestId: request.id,
        toolId: request.toolId,
        success: true,
        output,
        durationMs: Date.now() - startTime,
        sandboxed: tool.sandboxed && this.config.enableSandbox,
        evidenceRef: `vyrden.toolguard.exec.${request.id}`,
      };

      if (this.config.logAllExecutions) {
        this.executionLog.push(result);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      return this.createFailureResult(request, errorMessage, startTime);
    }
  }

  private createFailureResult(
    request: ToolExecutionRequest,
    error: string,
    startTime: number,
  ): ToolExecutionResult {
    const result: ToolExecutionResult = {
      requestId: request.id,
      toolId: request.toolId,
      success: false,
      error,
      durationMs: Date.now() - startTime,
      sandboxed: false,
      evidenceRef: `vyrden.toolguard.fail.${request.id}`,
    };

    if (this.config.logAllExecutions) {
      this.executionLog.push(result);
    }

    return result;
  }

  getExecutionLog(limit = 100): readonly ToolExecutionResult[] {
    return this.executionLog.slice(-limit);
  }

  getAgentExecutions(agentId: AgentId, limit = 50): readonly ToolExecutionResult[] {
    return this.executionLog
      .filter((r) => r.evidenceRef.includes(agentId))
      .slice(-limit);
  }

  clearLog(): void {
    this.executionLog.length = 0;
  }

  getStats(): {
    totalTools: number;
    totalPolicies: number;
    totalExecutions: number;
    successRate: number;
  } {
    const successes = this.executionLog.filter((r) => r.success).length;

    return {
      totalTools: this.tools.size,
      totalPolicies: this.policies.size,
      totalExecutions: this.executionLog.length,
      successRate: this.executionLog.length > 0 ? successes / this.executionLog.length : 0,
    };
  }
}

// Singleton instance
export const toolGuard = new ToolGuard();
