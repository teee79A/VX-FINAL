// VYRDON AI Room — Event Bus
// vyrden.com — Hidden Operations Center

import { randomUUID } from 'node:crypto';
import type { AgentId } from '../../core/types.js';
import type {
  AIEvent,
  EventHandler,
  EventSubscription,
  EventFilter,
  EventBusConfig,
  EventCategory,
  EventPriority,
} from './types.js';

export class EventBus {
  private readonly subscriptions: Map<string, EventSubscription>;
  private readonly history: AIEvent[];
  private readonly config: EventBusConfig;

  constructor(config: Partial<EventBusConfig> = {}) {
    this.subscriptions = new Map();
    this.history = [];
    this.config = {
      maxHistorySize: config.maxHistorySize ?? 1000,
      enableAsync: config.enableAsync ?? true,
      logAllEvents: config.logAllEvents ?? true,
    };
  }

  emit(
    type: string,
    category: EventCategory,
    payload: Record<string, unknown>,
    options: {
      priority?: EventPriority;
      source?: string;
      agentId?: AgentId;
    } = {},
  ): AIEvent {
    const event: AIEvent = {
      id: randomUUID(),
      type,
      category,
      priority: options.priority ?? 'normal',
      source: options.source ?? 'vyrden.airoom',
      payload,
      timestamp: new Date().toISOString(),
      evidenceRef: `vyrden.events.${category}.${type}.${Date.now()}`,
      ...(options.agentId !== undefined && { agentId: options.agentId }),
    };

    if (this.config.logAllEvents) {
      this.addToHistory(event);
    }

    this.dispatch(event);
    return event;
  }

  private addToHistory(event: AIEvent): void {
    this.history.push(event);
    while (this.history.length > this.config.maxHistorySize) {
      this.history.shift();
    }
  }

  private dispatch(event: AIEvent): void {
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesSubscription(event, subscription)) {
        if (this.config.enableAsync) {
          queueMicrotask(() => this.invokeHandler(subscription.handler, event));
        } else {
          this.invokeHandler(subscription.handler, event);
        }
      }
    }
  }

  private invokeHandler(handler: EventHandler, event: AIEvent): void {
    try {
      const result = handler(event);
      if (result instanceof Promise) {
        result.catch(() => {
          // Handler errors are silently swallowed to prevent cascade failures
        });
      }
    } catch {
      // Handler errors are silently swallowed
    }
  }

  private matchesSubscription(event: AIEvent, subscription: EventSubscription): boolean {
    if (subscription.category && event.category !== subscription.category) {
      return false;
    }
    if (subscription.type && event.type !== subscription.type) {
      return false;
    }
    if (subscription.agentId && event.agentId !== subscription.agentId) {
      return false;
    }
    return true;
  }

  subscribe(
    handler: EventHandler,
    filter?: {
      category?: EventCategory;
      type?: string;
      agentId?: AgentId;
    },
  ): string {
    const id = randomUUID();
    const subscription: EventSubscription = {
      id,
      handler,
      createdAt: new Date().toISOString(),
      ...(filter?.category !== undefined && { category: filter.category }),
      ...(filter?.type !== undefined && { type: filter.type }),
      ...(filter?.agentId !== undefined && { agentId: filter.agentId }),
    };

    this.subscriptions.set(id, subscription);
    return id;
  }

  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  on(type: string, handler: EventHandler): string {
    return this.subscribe(handler, { type });
  }

  onCategory(category: EventCategory, handler: EventHandler): string {
    return this.subscribe(handler, { category });
  }

  onAgent(agentId: AgentId, handler: EventHandler): string {
    return this.subscribe(handler, { agentId });
  }

  once(type: string, handler: EventHandler): string {
    const id = this.subscribe((event) => {
      this.unsubscribe(id);
      handler(event);
    }, { type });
    return id;
  }

  getHistory(filter?: EventFilter): readonly AIEvent[] {
    let events = [...this.history];

    if (filter) {
      if (filter.category) {
        events = events.filter((e) => e.category === filter.category);
      }
      if (filter.type) {
        events = events.filter((e) => e.type === filter.type);
      }
      if (filter.agentId) {
        events = events.filter((e) => e.agentId === filter.agentId);
      }
      if (filter.priority) {
        events = events.filter((e) => e.priority === filter.priority);
      }
      if (filter.source) {
        events = events.filter((e) => e.source === filter.source);
      }
      if (filter.startTime) {
        events = events.filter((e) => e.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        events = events.filter((e) => e.timestamp <= filter.endTime!);
      }
    }

    return events;
  }

  getRecentEvents(count = 50): readonly AIEvent[] {
    return this.history.slice(-count);
  }

  getEventsByCategory(category: EventCategory, limit = 100): readonly AIEvent[] {
    return this.history.filter((e) => e.category === category).slice(-limit);
  }

  clearHistory(): void {
    this.history.length = 0;
  }

  clearSubscriptions(): void {
    this.subscriptions.clear();
  }

  getStats(): {
    subscriptionCount: number;
    historySize: number;
    byCategory: Record<EventCategory, number>;
    byPriority: Record<EventPriority, number>;
  } {
    const byCategory: Record<EventCategory, number> = {
      agent: 0,
      task: 0,
      inference: 0,
      embedding: 0,
      tool: 0,
      calendar: 0,
      language: 0,
      system: 0,
      security: 0,
      error: 0,
    };

    const byPriority: Record<EventPriority, number> = {
      low: 0,
      normal: 0,
      high: 0,
      critical: 0,
    };

    for (const event of this.history) {
      byCategory[event.category]++;
      byPriority[event.priority]++;
    }

    return {
      subscriptionCount: this.subscriptions.size,
      historySize: this.history.length,
      byCategory,
      byPriority,
    };
  }
}

// Singleton instance
export const eventBus = new EventBus();
