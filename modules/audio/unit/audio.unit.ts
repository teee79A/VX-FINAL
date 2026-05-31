import { AudioProcessor } from "../processor/audio.processor.js";
import { AudioInput, AudioOutput } from "../audio.types.js";

export class AudioUnit {
  private readonly processor = new AudioProcessor();

  async run(input: AudioInput): Promise<AudioOutput> {
    return this.processor.run(input);
  }
}
