import { MemoryProcessor } from "../processor/memory.processor.js";
import { MemoryInput, MemoryOutput } from "../memory.types.js";

export class MemoryUnit {
  private readonly processor = new MemoryProcessor();

  async run(input: MemoryInput): Promise<MemoryOutput> {
    return this.processor.run(input);
  }
}
