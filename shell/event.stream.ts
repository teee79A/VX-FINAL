import { EventWrapper } from "../wrappers/event.wrapper.js";

export interface TowerEvent {
  type: string;
  payload: unknown;
  timestamp: string;
}

export class EventStream {
  private readonly wrapper = new EventWrapper();
  private readonly recent: TowerEvent[] = [];

  emit(type: string, payload: unknown): void {
    const event: TowerEvent = {
      type,
      payload,
      timestamp: new Date().toISOString()
    };
    this.recent.push(event);
    if (this.recent.length > 200) {
      this.recent.shift();
    }
    this.wrapper.emit({ type, payload });
  }

  on(type: string, listener: (payload: unknown) => void): void {
    this.wrapper.on(type, listener);
  }

  heartbeat(
    state: "green" | "yellow" | "red",
    metrics: Record<string, number>
  ): void {
    this.emit("tower.heartbeat", { state, metrics });
  }

  recentEvents(limit = 20): TowerEvent[] {
    return this.recent.slice(-Math.max(1, limit));
  }
}
