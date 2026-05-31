// ENGINES/base.ts
import type { Engine, EngineCategory, EngineContext, EngineResult, EngineStatus, EventHandler } from './types.js';

export abstract class BaseEngine implements Engine {
  abstract readonly id: string;
  abstract readonly type: EngineCategory;
  abstract readonly description: string;

  status: EngineStatus = 'idle';
  feeds?: string[];
  subscribes?: string[];
  onEvent?: EventHandler;

  protected started = 0;

  async execute(input: unknown, ctx: EngineContext): Promise<EngineResult> {
    const start = performance.now();
    this.status = 'running';
    try {
      const data = await this.run(input, ctx);
      this.status = 'idle';
      return { ok: true, data, durationMs: performance.now() - start, engineId: this.id };
    } catch (err) {
      this.status = 'error';
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg, durationMs: performance.now() - start, engineId: this.id };
    }
  }

  protected abstract run(input: unknown, ctx: EngineContext): Promise<unknown>;

  async healthcheck(): Promise<boolean> {
    return this.status !== 'disabled';
  }

  async shutdown(): Promise<void> {
    this.status = 'disabled';
  }

  protected emit(event: string, payload: unknown): void {
    // Wired by interconnect at boot — no JSON bus, direct call
    this.onEvent?.({ engineId: this.id, event, payload, timestamp: Date.now() });
  }
}
