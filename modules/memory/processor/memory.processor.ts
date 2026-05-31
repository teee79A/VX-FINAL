import { MemoryInput, MemoryOutput } from "../memory.types.js";

export class MemoryProcessor {
  private readonly store = new Map<string, string[]>();

  async run(input: MemoryInput): Promise<MemoryOutput> {
    const existing = this.store.get(input.sessionId) ?? [];
    if (input.op === "recall") {
      return {
        sessionId: input.sessionId,
        items: existing
      };
    }

    const next = [...existing, input.item];
    this.store.set(input.sessionId, next);
    return {
      appended: true,
      sessionId: input.sessionId,
      item: input.item
    };
  }
}
