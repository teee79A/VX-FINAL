// VYRDON AI Room — MCP Fast Connector
// Model Context Protocol — standardized agent-to-engine communication
// Zero-overhead protocol for all inter-component messaging
// vyrden.com — Hidden Operations Center

import { randomUUID } from 'node:crypto';
import type { AgentId } from '../../core/types.js';
import type { EngineId } from '../../engines/catalog.js';

// MCP Message Types
export type MCPMessageType =
  | 'task'        // Agent task request
  | 'result'      // Task result
  | 'query'       // Data query
  | 'event'       // System event
  | 'heartbeat'   // Health check
  | 'evidence'    // Evidence submission
  | 'control';    // Control command

export interface MCPMessage {
  id: string;
  type: MCPMessageType;
  source: string;     // sender ID (agent, engine, system)
  target: string;     // receiver ID
  payload: unknown;
  timestamp: string;
  ttl: number;        // milliseconds before expiry
  priority: number;   // 0=highest, 9=lowest
  trace: string[];    // message routing trace
}

export interface MCPChannel {
  id: string;
  name: string;
  subscribers: Set<string>;
  buffer: MCPMessage[];
  maxBuffer: number;
}

export type MCPHandler = (message: MCPMessage) => Promise<MCPMessage | void>;

// MCP Fast Connector — zero-copy in-process message bus
export class MCPConnector {
  private readonly channels: Map<string, MCPChannel> = new Map();
  private readonly handlers: Map<string, MCPHandler> = new Map();
  private readonly routingTable: Map<string, string> = new Map(); // target → handler
  private messageCount = 0;
  private readonly messageLog: MCPMessage[] = [];
  private readonly maxLog = 1000;

  constructor() {
    // Create default channels
    this.createChannel('agents', 50);
    this.createChannel('engines', 100);
    this.createChannel('system', 20);
    this.createChannel('evidence', 200);
    this.createChannel('control', 10);
  }

  // Create a named channel
  createChannel(name: string, maxBuffer = 50): MCPChannel {
    const channel: MCPChannel = {
      id: randomUUID(),
      name,
      subscribers: new Set(),
      buffer: [],
      maxBuffer,
    };
    this.channels.set(name, channel);
    return channel;
  }

  // Register a message handler for a component
  registerHandler(componentId: string, handler: MCPHandler): void {
    this.handlers.set(componentId, handler);
    this.routingTable.set(componentId, componentId);
  }

  // Subscribe a component to a channel
  subscribe(componentId: string, channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.subscribers.add(componentId);
    }
  }

  // Send a message to a specific target
  async send(message: Omit<MCPMessage, 'id' | 'timestamp' | 'trace'>): Promise<MCPMessage | void> {
    const msg: MCPMessage = {
      ...message,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      trace: [message.source],
    };

    this.messageCount++;
    this.logMessage(msg);

    // Direct routing
    const handler = this.handlers.get(message.target);
    if (handler) {
      msg.trace.push(message.target);
      return handler(msg);
    }

    // Channel broadcast
    const channel = this.channels.get(message.target);
    if (channel) {
      msg.trace.push(`channel:${message.target}`);
      channel.buffer.push(msg);
      if (channel.buffer.length > channel.maxBuffer) {
        channel.buffer.shift();
      }
      // Notify subscribers
      const results: Array<MCPMessage | void> = [];
      for (const sub of channel.subscribers) {
        const subHandler = this.handlers.get(sub);
        if (subHandler) {
          msg.trace.push(sub);
          results.push(await subHandler(msg));
        }
      }
      return results.find(r => r !== undefined);
    }

    return undefined;
  }

  // Convenience: send task to agent
  async sendTask(
    source: string,
    agentId: AgentId,
    task: string,
    priority = 5
  ): Promise<MCPMessage | void> {
    return this.send({
      type: 'task',
      source,
      target: agentId,
      payload: { task, agentId },
      ttl: 30000,
      priority,
    });
  }

  // Convenience: send evidence
  async submitEvidence(
    source: string,
    evidence: { taskId: string; content: string; agentId: AgentId }
  ): Promise<void> {
    await this.send({
      type: 'evidence',
      source,
      target: 'evidence',
      payload: evidence,
      ttl: 0, // Evidence never expires
      priority: 3,
    });
  }

  // Convenience: send heartbeat
  async heartbeat(componentId: string): Promise<void> {
    await this.send({
      type: 'heartbeat',
      source: componentId,
      target: 'system',
      payload: { alive: true, uptime: process.uptime() },
      ttl: 5000,
      priority: 9,
    });
  }

  // Query channel buffer
  getChannelMessages(channelName: string, limit = 20): MCPMessage[] {
    const channel = this.channels.get(channelName);
    if (!channel) return [];
    return channel.buffer.slice(-limit);
  }

  // Get stats
  getStats(): {
    channels: number;
    handlers: number;
    messageCount: number;
    channelStats: Array<{ name: string; subscribers: number; buffered: number }>;
  } {
    return {
      channels: this.channels.size,
      handlers: this.handlers.size,
      messageCount: this.messageCount,
      channelStats: Array.from(this.channels.entries()).map(([name, ch]) => ({
        name,
        subscribers: ch.subscribers.size,
        buffered: ch.buffer.length,
      })),
    };
  }

  // Get recent message log
  getLog(limit = 50): MCPMessage[] {
    return this.messageLog.slice(-limit);
  }

  private logMessage(msg: MCPMessage): void {
    this.messageLog.push(msg);
    if (this.messageLog.length > this.maxLog) {
      this.messageLog.splice(0, this.messageLog.length - this.maxLog);
    }
  }
}

// Singleton
let _connector: MCPConnector | null = null;

export function getMCPConnector(): MCPConnector {
  if (!_connector) {
    _connector = new MCPConnector();
  }
  return _connector;
}
