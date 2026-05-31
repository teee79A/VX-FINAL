// VYRDON AI Room WebSocket Handler
// Real-time agent communication — vyrden.com

import { randomUUID } from 'node:crypto';
import type WebSocket from 'ws';
import { type AgentId, type RoomMessage, type RoomState } from '../core/types.js';
import { getConfig } from '../core/config.js';
import { agentRegistry } from '../agents/registry.js';
import { getAgentIdentity } from '../agents/identity.js';
import { getGateway } from '../ai/gateway.js';

interface WebSocketClient {
  agentId: AgentId | 'OPERATOR';
  socket: WebSocket;
  connectedAt: number;
  lastActivity: number;
}

export class AIRoom {
  private readonly clients: Map<string, WebSocketClient>;
  private readonly state: RoomState;
  private readonly messageHistory: RoomMessage[];
  private readonly maxHistory: number;

  constructor(maxHistory = 1000) {
    this.clients = new Map();
    this.maxHistory = maxHistory;
    this.messageHistory = [];
    this.state = {
      activeAgents: new Set(),
      engineCount: 0,
      lastHeartbeat: new Map(),
      pendingCommands: new Map(),
    };
  }

  authenticate(token: string): AgentId | 'OPERATOR' | null {
    const config = getConfig();

    // Check operator access
    if (token === config.secret) return 'OPERATOR';

    // Check agent keys
    for (const [agentId, key] of config.agentKeys) {
      if (token === key) return agentId;
    }

    return null;
  }

  connect(socket: WebSocket, identity: AgentId | 'OPERATOR'): string {
    const clientId = randomUUID();
    const now = Date.now();

    this.clients.set(clientId, {
      agentId: identity,
      socket,
      connectedAt: now,
      lastActivity: now,
    });

    if (identity !== 'OPERATOR') {
      this.state.activeAgents.add(identity);
      this.state.lastHeartbeat.set(identity, now);
      agentRegistry.activate(identity);
    }

    console.log(`[AIRoom] Client connected: ${clientId} as ${identity}`);
    this.broadcastSystemMessage('agent_connected', { identity, clientId });

    return clientId;
  }

  disconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { agentId } = client;
    this.clients.delete(clientId);

    if (agentId !== 'OPERATOR') {
      // Only deactivate if no other clients for this agent
      const otherClients = Array.from(this.clients.values()).filter(c => c.agentId === agentId);
      if (otherClients.length === 0) {
        this.state.activeAgents.delete(agentId);
        agentRegistry.deactivate(agentId);
      }
    }

    console.log(`[AIRoom] Client disconnected: ${clientId} (${agentId})`);
    this.broadcastSystemMessage('agent_disconnected', { identity: agentId, clientId });
  }

  handleMessage(clientId: string, data: unknown): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = Date.now();

    if (typeof data !== 'object' || data === null) {
      this.sendToClient(clientId, { type: 'error', payload: { message: 'Invalid message format' } });
      return;
    }

    const msg = data as Partial<RoomMessage>;

    if (msg.type === 'heartbeat') {
      if (client.agentId !== 'OPERATOR') {
        this.state.lastHeartbeat.set(client.agentId, Date.now());
      }
      this.sendToClient(clientId, { type: 'heartbeat_ack', payload: { timestamp: new Date().toISOString() } });
      return;
    }

    // Handle task submission from frontend
    if (msg.type === 'submit_task') {
      this.handleTaskSubmission(clientId, msg.payload ?? {});
      return;
    }

    const roomMsg: RoomMessage = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      from: client.agentId,
      to: msg.to ?? 'ALL',
      type: msg.type ?? 'broadcast',
      payload: msg.payload ?? {},
      evidenceRef: `kitty.room.${Date.now()}`,
    };

    this.recordMessage(roomMsg);

    if (roomMsg.to === 'ALL') {
      this.broadcast(roomMsg, clientId);
    } else if (roomMsg.to === 'SYSTEM') {
      this.handleSystemCommand(roomMsg, clientId);
    } else {
      this.sendToAgent(roomMsg.to, roomMsg);
    }
  }

  private recordMessage(msg: RoomMessage): void {
    this.messageHistory.push(msg);
    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory.shift();
    }
  }

  private handleSystemCommand(msg: RoomMessage, fromClientId: string): void {
    const cmd = msg.payload['command'] as string | undefined;

    switch (cmd) {
      case 'status':
        this.sendToClient(fromClientId, {
          type: 'response',
          payload: {
            activeAgents: Array.from(this.state.activeAgents),
            engineCount: this.state.engineCount,
            clientCount: this.clients.size,
            uptime: process.uptime(),
          },
        });
        break;

      case 'agents':
        this.sendToClient(fromClientId, {
          type: 'response',
          payload: {
            agents: agentRegistry.getAll(),
            active: agentRegistry.getActiveIds(),
          },
        });
        break;

      case 'history':
        const limit = Math.min(Number(msg.payload['limit']) || 50, 200);
        this.sendToClient(fromClientId, {
          type: 'response',
          payload: { messages: this.messageHistory.slice(-limit) },
        });
        break;

      default:
        this.sendToClient(fromClientId, {
          type: 'error',
          payload: { message: `Unknown system command: ${cmd}` },
        });
    }
  }

  private broadcast(msg: RoomMessage, excludeClientId?: string): void {
    for (const [id, client] of this.clients) {
      if (id !== excludeClientId) {
        this.sendRaw(client.socket, msg);
      }
    }
  }

  private broadcastSystemMessage(event: string, data: Record<string, unknown>): void {
    const msg: RoomMessage = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      from: 'SYSTEM',
      to: 'ALL',
      type: 'broadcast',
      payload: { event, ...data },
    };
    this.recordMessage(msg);
    this.broadcast(msg);
  }

  private sendToAgent(agentId: AgentId, msg: RoomMessage): void {
    for (const [, client] of this.clients) {
      if (client.agentId === agentId) {
        this.sendRaw(client.socket, msg);
        return;
      }
    }
    console.warn(`[AIRoom] Target agent not connected: ${agentId}`);
  }

  private sendToClient(clientId: string, payload: { type: string; payload: Record<string, unknown> }): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.sendRaw(client.socket, payload);
    }
  }

  private sendRaw(socket: WebSocket, data: unknown): void {
    if (socket.readyState === 1) { // WebSocket.OPEN
      socket.send(JSON.stringify(data));
    }
  }

  setEngineCount(count: number): void {
    this.state.engineCount = count;
  }

  private async handleTaskSubmission(clientId: string, payload: Record<string, unknown>): Promise<void> {
    const taskText = (payload['task'] as string) ?? '';
    const agentName = (payload['agent'] as string) ?? 'auto';

    if (!taskText) {
      this.sendToClient(clientId, { type: 'error', payload: { message: 'Empty task' } });
      return;
    }

    // Resolve agent ID from name or code
    const AGENT_MAP: Record<string, AgentId> = {
      auto: 'DIR-1',
      abyssal: 'SEC-1',
      leverage: 'CFO-1',
      mammon: 'REV-1',
      obsidian: 'ENG-1',
      thunder: 'ENG-2',
      titan: 'BIZ-1',
      vyrdox: 'DIR-1',
      'SEC-1': 'SEC-1',
      'CFO-1': 'CFO-1',
      'REV-1': 'REV-1',
      'ENG-1': 'ENG-1',
      'ENG-2': 'ENG-2',
      'BIZ-1': 'BIZ-1',
      'DIR-1': 'DIR-1',
    };

    const agentId = AGENT_MAP[agentName] ?? 'DIR-1';
    const agent = agentRegistry.get(agentId);
    const agentDisplayName = agent?.name ?? agentId;

    // Send routed acknowledgment
    this.sendToClient(clientId, {
      type: 'routed',
      payload: { agent: agentDisplayName, agentId, task: taskText },
    });

    // Send agent status update (busy)
    const states: Record<string, string> = {};
    for (const a of agentRegistry.getAll()) {
      states[a.name.toLowerCase()] = a.id === agentId ? 'busy' : 'live';
    }
    this.sendToClient(clientId, { type: 'agent_status', payload: { states } });

    try {
      const gateway = getGateway();
      const task = await gateway.submitTask(taskText, { agentId });

      // Poll for completion
      const maxWait = 60_000;
      const pollInterval = 500;
      const start = Date.now();

      while (Date.now() - start < maxWait) {
        const current = gateway.getTask(task.id);
        if (!current || current.status === 'completed' || current.status === 'failed') {
          break;
        }
        await new Promise(r => setTimeout(r, pollInterval));
      }

      const completed = gateway.getTask(task.id);

      if (completed?.status === 'completed' && completed.result) {
        const identity = getAgentIdentity(agentId);

        this.sendToClient(clientId, {
          type: 'result',
          payload: {
            agent: agentDisplayName,
            agentId,
            content: completed.result,
            greeting: identity.greeting,
            model: identity.model,
            evidenceRef: completed.evidenceRef,
            taskId: completed.id,
            duration: completed.completedAt
              ? new Date(completed.completedAt).getTime() - new Date(completed.createdAt).getTime()
              : 0,
          },
        });
      } else {
        this.sendToClient(clientId, {
          type: 'error',
          payload: {
            message: completed?.error ?? 'Task timed out or failed',
            agent: agentDisplayName,
          },
        });
      }
    } catch (err) {
      this.sendToClient(clientId, {
        type: 'error',
        payload: { message: `Task execution failed: ${String(err)}`, agent: agentDisplayName },
      });
    }

    // Reset agent status to live
    const resetStates: Record<string, string> = {};
    for (const a of agentRegistry.getAll()) {
      resetStates[a.name.toLowerCase()] = 'live';
    }
    this.sendToClient(clientId, { type: 'agent_status', payload: { states: resetStates } });
  }

  getState(): Readonly<Omit<RoomState, 'activeAgents' | 'lastHeartbeat' | 'pendingCommands'> & {
    activeAgents: readonly AgentId[];
    lastHeartbeat: Record<AgentId, number>;
    pendingCommands: number;
  }> {
    return {
      activeAgents: Array.from(this.state.activeAgents),
      engineCount: this.state.engineCount,
      lastHeartbeat: Object.fromEntries(this.state.lastHeartbeat) as Record<AgentId, number>,
      pendingCommands: this.state.pendingCommands.size,
    };
  }
}

export const aiRoom = new AIRoom();
