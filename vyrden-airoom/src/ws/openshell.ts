// VYRDON OpenShell — Terminal Interface
// WebSocket-based shell for AI Room operations

import { randomUUID } from 'node:crypto';
import type WebSocket from 'ws';
import type { AgentId } from '../core/types.js';
import { agentRegistry } from '../agents/registry.js';
import { ENGINE_CATALOG, getEnginesByOwner, getEnginesByType } from '../engines/catalog.js';
import { getGateway } from '../ai/gateway.js';
import { memoryStore, promptInjector } from '../ai/memory/index.js';
import { getInferenceRouter } from '../ai/inference/router.js';
import { getConfig } from '../core/config.js';

interface ShellSession {
  id: string;
  socket: WebSocket;
  identity: AgentId | 'OPERATOR';
  connectedAt: number;
  lastActivity: number;
  currentAgent: AgentId | null;
  history: string[];
  env: Record<string, string>;
}

interface ShellCommand {
  name: string;
  description: string;
  usage: string;
  handler: (session: ShellSession, args: string[]) => Promise<string>;
}

class OpenShell {
  private readonly sessions: Map<string, ShellSession>;
  private readonly commands: Map<string, ShellCommand>;
  private readonly banner: string;

  constructor() {
    this.sessions = new Map();
    this.commands = new Map();
    this.banner = `
╔══════════════════════════════════════════════════════════════════╗
║                      VYRDON OPENSHELL v1.0                       ║
║                                                                  ║
║  Type 'help' for commands. Type 'agents' to list agents.        ║
║  Use 'use <agent>' to select an agent context.                   ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`;
    this.registerCommands();
  }

  authenticate(token: string): AgentId | 'OPERATOR' | null {
    const config = getConfig();
    if (token === config.secret) return 'OPERATOR';
    for (const [agentId, key] of config.agentKeys) {
      if (token === key) return agentId;
    }
    return null;
  }

  connect(socket: WebSocket, identity: AgentId | 'OPERATOR'): string {
    const sessionId = randomUUID();
    const now = Date.now();

    const session: ShellSession = {
      id: sessionId,
      socket,
      identity,
      connectedAt: now,
      lastActivity: now,
      currentAgent: identity === 'OPERATOR' ? null : identity,
      history: [],
      env: {
        USER: identity,
        SHELL: 'openshell',
        PWD: '/',
      },
    };

    this.sessions.set(sessionId, session);
    this.send(socket, { type: 'banner', content: this.banner });
    this.sendPrompt(session);

    return sessionId;
  }

  disconnect(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  async handleInput(sessionId: string, input: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActivity = Date.now();
    const trimmed = input.trim();

    if (!trimmed) {
      this.sendPrompt(session);
      return;
    }

    session.history.push(trimmed);
    if (session.history.length > 1000) session.history.shift();

    const parts = this.parseCommand(trimmed);
    const cmdName = parts[0]?.toLowerCase() ?? '';
    const args = parts.slice(1);

    const command = this.commands.get(cmdName);

    if (command) {
      try {
        const output = await command.handler(session, args);
        this.send(session.socket, { type: 'output', content: output });
      } catch (e: unknown) {
        this.send(session.socket, {
          type: 'error',
          content: `Error: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    } else if (cmdName) {
      this.send(session.socket, {
        type: 'error',
        content: `Unknown command: ${cmdName}. Type 'help' for available commands.`,
      });
    }

    this.sendPrompt(session);
  }

  private parseCommand(input: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (const char of input) {
      if ((char === '"' || char === "'") && !inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuote) {
        inQuote = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuote) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) parts.push(current);
    return parts;
  }

  private sendPrompt(session: ShellSession): void {
    const agent = session.currentAgent ?? 'vyrdon';
    const prompt = `[${session.identity}@${agent}]$ `;
    this.send(session.socket, { type: 'prompt', content: prompt });
  }

  private send(socket: WebSocket, data: { type: string; content: string }): void {
    if (socket.readyState === 1) {
      socket.send(JSON.stringify(data));
    }
  }

  private registerCommands(): void {
    // Help command
    this.commands.set('help', {
      name: 'help',
      description: 'Show available commands',
      usage: 'help [command]',
      handler: async (_session, args) => {
        if (args[0]) {
          const cmd = this.commands.get(args[0]);
          if (cmd) {
            return `${cmd.name}: ${cmd.description}\nUsage: ${cmd.usage}`;
          }
          return `Unknown command: ${args[0]}`;
        }

        const lines = ['Available commands:\n'];
        for (const [name, cmd] of this.commands) {
          lines.push(`  ${name.padEnd(16)} ${cmd.description}`);
        }
        lines.push('\nUse "help <command>" for more details.');
        return lines.join('\n');
      },
    });

    // Status command
    this.commands.set('status', {
      name: 'status',
      description: 'Show system status',
      usage: 'status',
      handler: async () => {
        const gateway = getGateway();
        const stats = await gateway.getStats();
        const inferenceRouter = getInferenceRouter();
        const inferenceStatus = await inferenceRouter.getStatus();

        return `
VYRDON AI Room Status
━━━━━━━━━━━━━━━━━━━━━━
Agents Active:    ${stats.activeAgents ?? 0}
Tasks Pending:    ${stats.tasksQueued ?? 0}
Tasks Completed:  ${stats.tasksProcessed ?? 0}
Inference Mode:   ${inferenceStatus.mode}
Ollama:           ${inferenceStatus.ollamaAvailable ? 'Connected' : 'Offline'}
Uptime:           ${Math.floor(process.uptime())}s
Memory:           ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
`;
      },
    });

    // Agents command
    this.commands.set('agents', {
      name: 'agents',
      description: 'List all agents',
      usage: 'agents [--active]',
      handler: async (_session, args) => {
        const agents = agentRegistry.getAll();
        const activeIds = agentRegistry.getActiveIds();
        const showOnlyActive = args.includes('--active');

        const lines = ['VYRDON Agents\n━━━━━━━━━━━━━━'];

        for (const agent of agents) {
          if (showOnlyActive && !activeIds.includes(agent.id)) continue;

          const status = activeIds.includes(agent.id) ? '●' : '○';
          lines.push(`${status} ${agent.id.padEnd(8)} ${agent.name.padEnd(12)} ${agent.role}`);
        }

        lines.push(`\nTotal: ${agents.length} | Active: ${activeIds.length}`);
        return lines.join('\n');
      },
    });

    // Use command (select agent context)
    this.commands.set('use', {
      name: 'use',
      description: 'Select agent context',
      usage: 'use <agent_id>',
      handler: async (session, args) => {
        if (!args[0]) {
          return 'Usage: use <agent_id>\nExample: use SEC-1';
        }

        const agentId = args[0].toUpperCase() as AgentId;
        const agent = agentRegistry.get(agentId);

        if (!agent) {
          return `Agent not found: ${agentId}`;
        }

        session.currentAgent = agentId;
        const engines = getEnginesByOwner(agentId);

        return `Switched to ${agent.name} (${agentId})
Role: ${agent.role}
Clearance: ${agent.clearanceLevel}
Capabilities: ${agent.capabilities.join(', ')}
Engines: ${engines.length}`;
      },
    });

    // Engines command
    this.commands.set('engines', {
      name: 'engines',
      description: 'List engines',
      usage: 'engines [--type <type>] [--owner <agent>]',
      handler: async (_session, args) => {
        const typeIdx = args.indexOf('--type');
        const ownerIdx = args.indexOf('--owner');

        let engineIds: readonly string[];
        const typeArg = typeIdx !== -1 ? args[typeIdx + 1] : undefined;
        const ownerArg = ownerIdx !== -1 ? args[ownerIdx + 1] : undefined;

        if (typeArg) {
          engineIds = getEnginesByType(typeArg as never);
        } else if (ownerArg) {
          engineIds = getEnginesByOwner(ownerArg.toUpperCase() as AgentId);
        } else {
          engineIds = Object.keys(ENGINE_CATALOG);
        }

        const lines = ['VYRDON Engines\n━━━━━━━━━━━━━━'];

        for (const id of engineIds.slice(0, 50)) {
          const spec = ENGINE_CATALOG[id as keyof typeof ENGINE_CATALOG];
          if (spec) {
            lines.push(`  ${id.padEnd(24)} ${spec.type.padEnd(12)} ${spec.owner}`);
          }
        }

        if (engineIds.length > 50) {
          lines.push(`\n... and ${engineIds.length - 50} more`);
        }

        lines.push(`\nTotal: ${engineIds.length}`);
        return lines.join('\n');
      },
    });

    // Memory command
    this.commands.set('memory', {
      name: 'memory',
      description: 'Memory system operations',
      usage: 'memory stats | memory list [agent] | memory add <content>',
      handler: async (session, args) => {
        const subcmd = args[0]?.toLowerCase();

        if (subcmd === 'stats') {
          const stats = memoryStore.getStats();
          return `
Memory Stats
━━━━━━━━━━━━
Total Entries: ${stats.totalEntries}
Storage:       ${Math.round(stats.storageBytes / 1024)}KB
By Type:       ${Object.entries(stats.byType).map(([k, v]) => `${k}:${v}`).join(', ')}
By Agent:      ${Object.entries(stats.byAgent).map(([k, v]) => `${k}:${v}`).join(', ')}`;
        }

        if (subcmd === 'list') {
          const agentId = args[1]?.toUpperCase() as AgentId | undefined;
          const queryAgentId = agentId ?? session.currentAgent ?? undefined;
          const memories = memoryStore.query(
            queryAgentId !== undefined
              ? { agentId: queryAgentId, limit: 20 }
              : { limit: 20 }
          );

          const lines = ['Memories\n━━━━━━━━'];
          for (const mem of memories) {
            lines.push(`[${mem.type.padEnd(10)}] ${mem.content.slice(0, 60)}...`);
          }
          return lines.join('\n') || 'No memories found.';
        }

        if (subcmd === 'add' && args.slice(1).length > 0) {
          const content = args.slice(1).join(' ');
          const agentId = session.currentAgent ?? 'system';
          const entry = promptInjector.addFact(agentId, content);
          return `Added memory: ${entry.id}`;
        }

        return 'Usage: memory stats | memory list [agent] | memory add <content>';
      },
    });

    // Chat command (talk to an agent)
    this.commands.set('chat', {
      name: 'chat',
      description: 'Send message to current agent',
      usage: 'chat <message>',
      handler: async (session, args) => {
        if (!args.length) {
          return 'Usage: chat <message>';
        }

        const message = args.join(' ');
        const agentId = session.currentAgent;

        if (!agentId) {
          return 'No agent selected. Use "use <agent_id>" first.';
        }

        const router = getInferenceRouter();
        const context = promptInjector.buildContext(agentId, message);

        try {
          const response = await router.generate({
            prompt: message,
            systemPrompt: context.systemPrompt,
          });

          // Record interaction for memory
          promptInjector.recordInteraction(agentId, message, response.text);

          return `${agentId}: ${response.text}`;
        } catch (e: unknown) {
          return `Inference error: ${e instanceof Error ? e.message : String(e)}`;
        }
      },
    });

    // Task command
    this.commands.set('task', {
      name: 'task',
      description: 'Submit task to gateway',
      usage: 'task <prompt> [--agent <id>] [--priority <level>]',
      handler: async (_session, args) => {
        if (!args.length) {
          return 'Usage: task <prompt> [--agent <id>] [--priority <level>]';
        }

        const agentIdx = args.indexOf('--agent');
        const priorityIdx = args.indexOf('--priority');

        let prompt = args.join(' ');
        let agentId: AgentId | undefined;
        let priority: 'critical' | 'high' | 'normal' | 'low' = 'normal';

        const agentArg = agentIdx !== -1 ? args[agentIdx + 1] : undefined;
        const priorityArg = priorityIdx !== -1 ? args[priorityIdx + 1] : undefined;

        if (agentArg) {
          agentId = agentArg.toUpperCase() as AgentId;
          prompt = prompt.replace(`--agent ${agentArg}`, '').trim();
        }

        if (priorityArg) {
          priority = priorityArg as typeof priority;
          prompt = prompt.replace(`--priority ${priorityArg}`, '').trim();
        }

        const gateway = getGateway();
        const task = await gateway.submitTask(
          prompt,
          agentId !== undefined ? { agentId, priority } : { priority }
        );

        return `Task submitted: ${task.id}\nStatus: ${task.status}`;
      },
    });

    // Env command
    this.commands.set('env', {
      name: 'env',
      description: 'Show or set environment variables',
      usage: 'env [KEY=value]',
      handler: async (session, args) => {
        if (!args.length) {
          const lines = ['Environment:\n'];
          for (const [key, value] of Object.entries(session.env)) {
            lines.push(`  ${key}=${value}`);
          }
          return lines.join('\n');
        }

        const firstArg = args[0];
        if (!firstArg) {
          return 'Usage: env [KEY=value]';
        }

        const parts = firstArg.split('=');
        const key = parts[0];
        const rest = parts.slice(1);

        if (key && rest.length > 0) {
          session.env[key] = rest.join('=');
          return `${key}=${session.env[key]}`;
        }

        if (key) {
          return session.env[key] ?? `Variable not set: ${key}`;
        }

        return 'Invalid environment variable format.';
      },
    });

    // History command
    this.commands.set('history', {
      name: 'history',
      description: 'Show command history',
      usage: 'history [count]',
      handler: async (session, args) => {
        const count = parseInt(args[0] ?? '20', 10);
        const recent = session.history.slice(-count);
        return recent.map((cmd, i) => `${i + 1}  ${cmd}`).join('\n');
      },
    });

    // Clear command
    this.commands.set('clear', {
      name: 'clear',
      description: 'Clear terminal',
      usage: 'clear',
      handler: async () => {
        return '\x1Bc'; // ANSI clear
      },
    });

    // Exit command
    this.commands.set('exit', {
      name: 'exit',
      description: 'Close shell session',
      usage: 'exit',
      handler: async (session) => {
        session.socket.close(1000, 'Session closed');
        return 'Goodbye.';
      },
    });

    // Whoami command
    this.commands.set('whoami', {
      name: 'whoami',
      description: 'Show current identity',
      usage: 'whoami',
      handler: async (session) => {
        const agent = session.currentAgent ? agentRegistry.get(session.currentAgent) : null;
        if (agent) {
          return `Identity: ${session.identity}\nAgent: ${agent.name} (${agent.id})\nRole: ${agent.role}`;
        }
        return `Identity: ${session.identity}\nNo agent context selected.`;
      },
    });

    // Models command
    this.commands.set('models', {
      name: 'models',
      description: 'List available models',
      usage: 'models',
      handler: async () => {
        const router = getInferenceRouter();
        const allModels = await router.listAllModels();
        const status = await router.getStatus();

        const lines = ['Available Models\n━━━━━━━━━━━━━━━━'];
        lines.push(`\nActive Provider: ${status.activeProvider}`);

        for (const [provider, models] of Object.entries(allModels)) {
          if (models.length > 0) {
            lines.push(`\n${provider.toUpperCase()}:`);
            for (const model of models) {
              lines.push(`  • ${model.name} (${model.size})`);
            }
          }
        }

        if (status.openRouterConfigured) {
          lines.push('\nOpenRouter: Configured (cloud fallback)');
        }

        return lines.join('\n');
      },
    });
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}

export const openShell = new OpenShell();
