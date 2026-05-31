import { RagProcessor } from "../processor/rag.processor.js";
import { RagInput, RagOutput } from "../rag.types.js";

export class RagUnit {
  private readonly processor = new RagProcessor();

  async run(input: RagInput): Promise<RagOutput> {
    return this.processor.run(input);
  }
}
