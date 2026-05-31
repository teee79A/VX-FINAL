import { VoiceProcessor } from "../processor/voice.processor.js";
import { VoiceInput, VoiceOutput } from "../voice.types.js";

export class VoiceUnit {
  private readonly processor = new VoiceProcessor();

  async run(input: VoiceInput): Promise<VoiceOutput> {
    return this.processor.run(input);
  }
}
