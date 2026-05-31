import { AudioInput, AudioOutput } from "../audio.types.js";

export class AudioProcessor {
  async run(input: AudioInput): Promise<AudioOutput> {
    if (input.op === "capture_level") {
      return {
        roomId: input.roomId,
        levelDb: input.levelDb,
        status:
          input.levelDb > -6 ? "hot" : input.levelDb < -50 ? "silent" : "ok"
      };
    }

    return {
      roomId: input.roomId,
      chunkId: input.chunkId,
      transcript:
        input.transcriptHint?.trim() || "[audio chunk transcribed by local lane]"
    };
  }
}
