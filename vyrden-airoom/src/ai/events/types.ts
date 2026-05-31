// VYRDON AI Room — Event Types
// vyrden.com — Hidden Operations Center

import type { AgentId } from '../../core/types.js';

export type EventPriority = 'low' | 'normal' | 'high' | 'critical';
export type EventCategory =
  | 'agent'
  | 'task'
  | 'inference'
  | 'embedding'
  | 'tool'
  | 'calendar'
  | 'language'
  | 'system'
  | 'security'
  | 'error';

export interface AIEvent {
  id: string;
  type: string;
  category: EventCategory;
  priority: EventPriority;
  source: string;
  agentId?: AgentId;
  payload: Record<string, unknown>;
  timestamp: string;
  evidenceRef: string;
}

export type EventHandler = (event: AIEvent) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  category?: EventCategory;
  type?: string;
  agentId?: AgentId;
  handler: EventHandler;
  createdAt: string;
}

export interface EventFilter {
  category?: EventCategory;
  type?: string;
  agentId?: AgentId;
  priority?: EventPriority;
  startTime?: string;
  endTime?: string;
  source?: string;
}

export interface EventBusConfig {
  maxHistorySize: number;
  enableAsync: boolean;
  logAllEvents: boolean;
}
