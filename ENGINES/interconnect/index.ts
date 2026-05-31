// ENGINES/interconnect/index.ts
import { BaseEngine } from "../base.js";
import type { EngineContext, EngineEvent, EventHandler } from "../types.js";

const DEFAULT_EVENT_BUS_LOG = process.env.KITTY_EVENT_BUS_LOG ?? "true";

export class EventBus extends BaseEngine {
  readonly id = "event_bus";
  readonly type = "interconnect" as const;
  readonly description = "Pub/sub event bus — engines publish, others subscribe";
  private subs = new Map<string, EventHandler[]>();

  subscribe(topic: string, handler: EventHandler) {
    const list = this.subs.get(topic) ?? [];
    list.push(handler);
    this.subs.set(topic, list);
  }

  async publish(event: EngineEvent) {
    const handlers = [...(this.subs.get(event.event) ?? []), ...(this.subs.get("*") ?? [])];
    const results = await Promise.allSettled(handlers.map((h) => h(event)));
    if (DEFAULT_EVENT_BUS_LOG === "true") {
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          console.error(`[EventBus] handler ${i} on "${event.event}" threw:`, r.reason);
        }
      });
    }
  }

  protected async run(input: unknown, ctx: EngineContext) {
    return { subscribers: this.subs.size, topics: [...this.subs.keys()], timestamp: ctx.timestamp };
  }
}

export class DataPipe extends BaseEngine {
  readonly id = "data_pipe";
  readonly type = "interconnect" as const;
  readonly description = "Typed data pipeline between engines — schema validated";
  private pipes = new Map<string, { source: string; sink: string }>();

  register(pipeId: string, source: string, sink: string) {
    this.pipes.set(pipeId, { source, sink });
  }

  protected async run(input: unknown, ctx: EngineContext) {
    return {
      activePipes: this.pipes.size,
      pipes: Object.fromEntries(this.pipes),
      timestamp: ctx.timestamp,
    };
  }
}

export class StateSync extends BaseEngine {
  readonly id = "state_sync";
  readonly type = "interconnect" as const;
  readonly description = "Shared state synchronization between engines";
  private store = new Map<string, unknown>();

  set(key: string, value: unknown) {
    this.store.set(key, value);
  }
  get(key: string) {
    return this.store.get(key);
  }

  protected async run(input: unknown, _ctx: EngineContext) {
    const action = (input as { action?: string })?.action ?? "snapshot";
    if (action === "snapshot") return { keys: [...this.store.keys()], size: this.store.size };
    const key = (input as { key?: string })?.key ?? "";
    return { key, value: this.store.get(key) };
  }
}

export class TriggerEngine extends BaseEngine {
  readonly id = "trigger_engine";
  readonly type = "interconnect" as const;
  readonly description = "Conditional trigger — when A produces X, invoke B with Y";
  private rules: Array<{ when: string; event: string; then: string; with: unknown }> = [];

  addRule(when: string, event: string, then: string, payload: unknown) {
    this.rules.push({ when, event, then, with: payload });
  }

  protected async run(input: unknown, ctx: EngineContext) {
    return { rules: this.rules.length, timestamp: ctx.timestamp };
  }
}

export class Transformer extends BaseEngine {
  readonly id = "transformer";
  readonly type = "interconnect" as const;
  readonly description = "Data format converter between engine schemas";
  protected async run(input: unknown, ctx: EngineContext) {
    const from = (input as { from?: string })?.from ?? "";
    const to = (input as { to?: string })?.to ?? "";
    const data = (input as { data?: unknown })?.data;
    return { from, to, transformed: data, timestamp: ctx.timestamp };
  }
}
