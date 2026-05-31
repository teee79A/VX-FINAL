// VYRDON Prompt Auto-Injector
// Automatically injects context and memories into prompts

import type { AgentId } from '../../core/types.js';
import type { InjectionContext, MemoryEntry, PromptTemplate } from './types.js';
import { memoryStore } from './store.js';
import { agentRegistry } from '../../agents/registry.js';

interface InjectionOptions {
  includeMemories?: boolean;
  includeTemplates?: boolean;
  maxMemories?: number;
  customContext?: string;
}

class PromptInjector {
  // Build full injection context for an agent
  buildContext(agentId: AgentId, userPrompt: string, options: InjectionOptions = {}): InjectionContext {
    const {
      includeMemories = true,
      includeTemplates = true,
      maxMemories = 10,
      customContext,
    } = options;

    const agent = agentRegistry.get(agentId);
    const memories: MemoryEntry[] = includeMemories
      ? memoryStore.getAllForAgent(agentId, maxMemories)
      : [];

    // Build system prompt
    const systemParts: string[] = [];

    // Agent identity
    if (agent) {
      systemParts.push(`You are ${agent.name} (${agent.id}), the ${agent.role} agent.`);
      systemParts.push(`Capabilities: ${agent.capabilities.join(', ')}`);
      systemParts.push(`Clearance Level: ${agent.clearanceLevel}`);
    }

    // Auto-inject templates
    if (includeTemplates) {
      const templates = memoryStore.getAutoInjectTemplates(agentId);
      for (const template of templates) {
        const rendered = this.renderTemplate(template, { agentId, prompt: userPrompt });
        systemParts.push(rendered);
      }
    }

    // Inject memories as context
    if (memories.length > 0) {
      systemParts.push('\n--- MEMORY CONTEXT ---');
      for (const mem of memories) {
        systemParts.push(`[${mem.type.toUpperCase()}] ${mem.content}`);
      }
      systemParts.push('--- END MEMORY ---\n');
    }

    // Custom context
    if (customContext) {
      systemParts.push(customContext);
    }

    return {
      agentId,
      prompt: userPrompt,
      memories,
      systemPrompt: systemParts.join('\n'),
      timestamp: new Date().toISOString(),
    };
  }

  // Render a template with variables
  renderTemplate(template: PromptTemplate, vars: Record<string, unknown>): string {
    let content = template.content;
    for (const variable of template.variables) {
      const value = vars[variable];
      if (value !== undefined) {
        content = content.replace(new RegExp(`\\{\\{${variable}\\}\\}`, 'g'), String(value));
      }
    }
    return content;
  }

  // Create injection memory for future use
  recordInteraction(agentId: AgentId, prompt: string, response: string): void {
    // Store as history for future context
    memoryStore.create({
      agentId,
      type: 'history',
      content: `Q: ${prompt.slice(0, 200)}\nA: ${response.slice(0, 500)}`,
      metadata: {
        promptLength: prompt.length,
        responseLength: response.length,
      },
      priority: 3,
      tags: ['interaction', 'auto'],
    });
  }

  // Add fact to memory
  addFact(agentId: AgentId | 'system', fact: string, priority = 5): MemoryEntry {
    return memoryStore.create({
      agentId,
      type: 'fact',
      content: fact,
      metadata: {},
      priority,
      tags: ['fact', 'manual'],
    });
  }

  // Add injection that will always be included
  addInjection(agentId: AgentId | 'system', content: string, priority = 10): MemoryEntry {
    return memoryStore.create({
      agentId,
      type: 'injection',
      content,
      metadata: {},
      priority,
      tags: ['injection', 'persistent'],
    });
  }

  // Get injection summary
  getSummary(agentId: AgentId): { memoryCount: number; templateCount: number; injections: string[] } {
    const memories = memoryStore.getAllForAgent(agentId, 100);
    const templates = memoryStore.getAutoInjectTemplates(agentId);
    const injections = memoryStore.getForInjection(agentId, 20);

    return {
      memoryCount: memories.length,
      templateCount: templates.length,
      injections: injections.map(i => i.content.slice(0, 100)),
    };
  }
}

export const promptInjector = new PromptInjector();
