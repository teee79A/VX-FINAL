import { EventEmitter } from "node:events";

export class EventWrapper {
  private readonly emitter = new EventEmitter();

  emit(event: { type: string; payload: unknown }): void {
    this.emitter.emit(event.type, event.payload);
  }

  on(type: string, listener: (payload: unknown) => void): void {
    this.emitter.on(type, listener);
  }
}
