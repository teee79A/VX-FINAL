// VYRDON AI Room — Claude Code Logic (Central Brain)
// Claude's structured reasoning patterns injected as the orchestration core
// All agents flow through this — task decomposition, evidence chaining, multi-agent coordination
// vyrden.com — Hidden Operations Center

import type { AgentId } from '../../core/types.js';
import { getAgentIdentity } from '../../agents/identity.js';
import { getInferenceRouter } from '../inference/router.js';
import { promptInjector } from '../memory/index.js';
import { memoryStore } from '../memory/store.js';

export interface DecomposedTask {
  id: string;
  original: string;
  subtasks: Array<{
    step: number;
    description: string;
    agentId: AgentId;
    dependencies: number[];
    priority: 'critical' | 'high' | 'normal';
  }>;
  reasoning: string;
  evidenceChain: string[];
}

export interface BrainDecision {
  action: 'route' | 'decompose' | 'escalate' | 'execute' | 'reject';
  agentId?: AgentId;
  reasoning: string;
  confidence: number;
  subtasks?: string[];
  evidence: string;
}

// Agent routing keywords for deterministic fast-path
const ROUTING_RULES: Record<string, AgentId> = {
  'security': 'SEC-1', 'threat': 'SEC-1', 'vuln': 'SEC-1', 'pentest': 'SEC-1', 'audit': 'SEC-1',
  'hack': 'SEC-1', 'exploit': 'SEC-1', 'breach': 'SEC-1',
  'finance': 'CFO-1', 'treasury': 'CFO-1', 'budget': 'CFO-1', 'cost': 'CFO-1', 'revenue': 'CFO-1',
  'invoice': 'CFO-1', 'payment': 'CFO-1', 'burn': 'CFO-1', 'runway': 'CFO-1',
  'strategy': 'REV-1', 'market': 'REV-1', 'competitor': 'REV-1', 'growth': 'REV-1', 'gtm': 'REV-1',
  'pricing': 'REV-1', 'positioning': 'REV-1',
  'code': 'ENG-1', 'architecture': 'ENG-1', 'design': 'ENG-1', 'review': 'ENG-1', 'refactor': 'ENG-1',
  'schema': 'ENG-1', 'api': 'ENG-1', 'contract': 'ENG-1',
  'deploy': 'ENG-2', 'infra': 'ENG-2', 'ci': 'ENG-2', 'cd': 'ENG-2', 'docker': 'ENG-2',
  'monitor': 'ENG-2', 'uptime': 'ENG-2', 'server': 'ENG-2', 'ops': 'ENG-2',
  'intelligence': 'BIZ-1', 'analytics': 'BIZ-1', 'trend': 'BIZ-1', 'data': 'BIZ-1',
  'report': 'BIZ-1', 'kpi': 'BIZ-1', 'metric': 'BIZ-1',
};

// Claude Code Logic — the central reasoning system
export class ClaudeCodeBrain {
  // Structured reasoning: analyze → plan → route → execute → verify
  async analyze(prompt: string, context?: string): Promise<BrainDecision> {
    const lower = prompt.toLowerCase();

    // 1. Fast-path: deterministic keyword routing
    const matchedAgent = this.fastRoute(lower);

    // 2. Check complexity — does this need decomposition?
    const isComplex = this.assessComplexity(prompt);

    if (isComplex) {
      return {
        action: 'decompose',
        agentId: 'DIR-1',
        reasoning: `Complex multi-domain task detected. Decomposing into subtasks for parallel agent execution.`,
        confidence: 0.85,
        subtasks: this.quickDecompose(prompt),
        evidence: `claude-brain.decompose.${Date.now()}`,
      };
    }

    if (matchedAgent) {
      return {
        action: 'route',
        agentId: matchedAgent,
        reasoning: `Routed to ${matchedAgent} — domain match on task keywords.`,
        confidence: 0.9,
        evidence: `claude-brain.route.${matchedAgent}.${Date.now()}`,
      };
    }

    // Default: route to DIR-1 for orchestration
    return {
      action: 'route',
      agentId: 'DIR-1',
      reasoning: 'No specific domain match. Routing to DIR-1 VYRDOX for orchestration.',
      confidence: 0.7,
      evidence: `claude-brain.route.dir1.${Date.now()}`,
    };
  }

  // Full task decomposition — breaks complex tasks into agent-specific subtasks
  async decompose(prompt: string, agentId?: AgentId): Promise<DecomposedTask> {
    const router = getInferenceRouter();

    const decompositionPrompt = `
TASK DECOMPOSITION PROTOCOL — VYRDON CLAUDE LOGIC

You are the central brain. Decompose this task into precise subtasks.

AVAILABLE AGENTS:
- SEC-1 ABYSSAL: Security, threats, vulnerabilities, audits
- CFO-1 LEVERAGE: Finance, treasury, costs, revenue
- REV-1 MAMMON: Strategy, markets, growth, positioning
- ENG-1 OBSIDIAN: Code, architecture, design, APIs
- ENG-2 THUNDER: Infrastructure, deployment, CI/CD, monitoring
- BIZ-1 TITAN: Intelligence, analytics, data, trends
- DIR-1 VYRDOX: Orchestration, coordination

TASK: ${prompt}

Respond ONLY in this JSON format:
{
  "subtasks": [
    { "step": 1, "description": "...", "agent": "SEC-1", "dependencies": [], "priority": "high" },
    { "step": 2, "description": "...", "agent": "ENG-1", "dependencies": [1], "priority": "normal" }
  ],
  "reasoning": "Why this decomposition"
}`;

    try {
      const response = await router.generate({
        prompt: decompositionPrompt,
        systemPrompt: 'You are VYRDON Claude Code Logic — the central reasoning brain. Respond only in valid JSON.',
        temperature: 0.3,
        maxTokens: 2048,
      });

      const parsed = this.parseDecomposition(response.content, prompt);
      return parsed;
    } catch {
      // Fallback: simple single-agent routing
      return {
        id: `decomp-${Date.now()}`,
        original: prompt,
        subtasks: [{
          step: 1,
          description: prompt,
          agentId: agentId ?? 'DIR-1',
          dependencies: [],
          priority: 'normal',
        }],
        reasoning: 'Fallback — single task execution',
        evidenceChain: [`claude-brain.fallback.${Date.now()}`],
      };
    }
  }

  // Evidence chaining — link task results across agents
  chainEvidence(
    taskId: string,
    agentId: AgentId,
    result: string,
    parentEvidence?: string
  ): string {
    const evidenceRef = `evidence.${agentId}.${taskId}.${Date.now()}`;

    memoryStore.create({
      agentId,
      type: 'fact',
      content: `[EVIDENCE] Task ${taskId}: ${result.slice(0, 500)}`,
      metadata: {
        taskId,
        parentEvidence: parentEvidence ?? null,
        evidenceRef,
        timestamp: new Date().toISOString(),
      },
      priority: 8,
      tags: ['evidence', 'chain', taskId],
    });

    return evidenceRef;
  }

  // Build enhanced system prompt with Claude Code reasoning patterns
  buildEnhancedPrompt(agentId: AgentId, taskPrompt: string, context?: string): string {
    const identity = getAgentIdentity(agentId);
    const injection = promptInjector.buildContext(agentId, taskPrompt, {
      includeMemories: true,
      includeTemplates: true,
      maxMemories: 15,
    });

    return `${identity.systemPrompt}

--- CLAUDE CODE LOGIC INJECTION ---
REASONING PROTOCOL:
1. ANALYZE the task — what is being asked, what domain, what data needed
2. PLAN your approach — steps, dependencies, risks
3. EXECUTE precisely — no filler, no hedging, actionable output
4. EVIDENCE your work — cite sources, reference data, timestamp findings
5. VERIFY — cross-check conclusions against available data

CONSTRAINTS:
- Every claim must be evidenced or flagged as assumption
- Confidence levels: HIGH (data-backed) / MEDIUM (inferred) / LOW (speculative)
- Format responses for machine parsing when possible
- Escalate blockers immediately — do not stall
- All agents share VYRDON territory — coordinate, don't compete

VYRDON LAW (Immutable):
1. Execution without evidence is void
2. Agents are identified, not anonymous
3. The seal cannot be retroactively modified
4. AI Room and Runtime are separated by architecture
5. Security operations are visible
6. Financial operations require multi-signature
7. The protocol is the law
--- END INJECTION ---

${injection.systemPrompt}
${context ? `\nADDITIONAL CONTEXT:\n${context}` : ''}`;
  }

  // Multi-agent coordination — execute subtasks across agents
  async coordinateExecution(
    decomposed: DecomposedTask,
    executeSubtask: (agentId: AgentId, prompt: string) => Promise<string>
  ): Promise<Map<number, string>> {
    const results = new Map<number, string>();
    const completed = new Set<number>();

    // Execute in dependency order
    while (completed.size < decomposed.subtasks.length) {
      const ready = decomposed.subtasks.filter(st =>
        !completed.has(st.step) &&
        st.dependencies.every(dep => completed.has(dep))
      );

      if (ready.length === 0 && completed.size < decomposed.subtasks.length) {
        // Deadlock — force remaining
        const remaining = decomposed.subtasks.filter(st => !completed.has(st.step));
        for (const st of remaining) {
          try {
            const result = await executeSubtask(st.agentId, st.description);
            results.set(st.step, result);
            this.chainEvidence(decomposed.id, st.agentId, result);
          } catch (e) {
            results.set(st.step, `FAILED: ${String(e)}`);
          }
          completed.add(st.step);
        }
        break;
      }

      // Execute ready tasks (could be parallel, but serialized for CPU constraint)
      for (const st of ready) {
        // Inject previous step results as context
        const prevResults = st.dependencies
          .map(dep => results.get(dep))
          .filter(Boolean)
          .join('\n---\n');

        const enrichedPrompt = prevResults
          ? `${st.description}\n\nPREVIOUS STEP RESULTS:\n${prevResults}`
          : st.description;

        try {
          const result = await executeSubtask(st.agentId, enrichedPrompt);
          results.set(st.step, result);
          this.chainEvidence(decomposed.id, st.agentId, result);
        } catch (e) {
          results.set(st.step, `FAILED: ${String(e)}`);
        }
        completed.add(st.step);
      }
    }

    return results;
  }

  // --- Internal helpers ---

  private fastRoute(lower: string): AgentId | null {
    const words = lower.split(/\s+/);
    const scores: Partial<Record<AgentId, number>> = {};

    for (const word of words) {
      const agent = ROUTING_RULES[word];
      if (agent) {
        scores[agent] = (scores[agent] ?? 0) + 1;
      }
    }

    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    return sorted.length > 0 ? sorted[0]![0] as AgentId : null;
  }

  private assessComplexity(prompt: string): boolean {
    const indicators = [
      /and\s+(also|then|additionally)/i,
      /first.*then.*finally/i,
      /multi/i,
      /across\s+(all|every|multiple)/i,
      /compare.*with/i,
      /both.*and/i,
      prompt.split(/[.!?]/).length > 3,
      prompt.length > 500,
    ];
    const score = indicators.filter(i => typeof i === 'boolean' ? i : i.test(prompt)).length;
    return score >= 3;
  }

  private quickDecompose(prompt: string): string[] {
    // Simple sentence-based decomposition
    const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.length > 1 ? sentences.map(s => s.trim()) : [prompt];
  }

  private parseDecomposition(content: string, original: string): DecomposedTask {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');

      const parsed = JSON.parse(jsonMatch[0]) as {
        subtasks: Array<{
          step: number;
          description: string;
          agent: string;
          dependencies: number[];
          priority: string;
        }>;
        reasoning: string;
      };

      return {
        id: `decomp-${Date.now()}`,
        original,
        subtasks: parsed.subtasks.map(st => ({
          step: st.step,
          description: st.description,
          agentId: st.agent as AgentId,
          dependencies: st.dependencies,
          priority: (st.priority as 'critical' | 'high' | 'normal') ?? 'normal',
        })),
        reasoning: parsed.reasoning,
        evidenceChain: [],
      };
    } catch {
      return {
        id: `decomp-${Date.now()}`,
        original,
        subtasks: [{
          step: 1,
          description: original,
          agentId: 'DIR-1',
          dependencies: [],
          priority: 'normal',
        }],
        reasoning: 'Parse failed — single task fallback',
        evidenceChain: [],
      };
    }
  }
}

// Singleton
let _brain: ClaudeCodeBrain | null = null;

export function getClaudeBrain(): ClaudeCodeBrain {
  if (!_brain) {
    _brain = new ClaudeCodeBrain();
  }
  return _brain;
}
