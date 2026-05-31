import { RagInput, RagOutput } from "../rag.types.js";

export class RagProcessor {
  async run(input: RagInput): Promise<RagOutput> {
    return {
      query: input.query,
      answers: []
    };
  }
}
