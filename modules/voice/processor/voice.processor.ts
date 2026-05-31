import { VoiceInput, VoiceOutput } from "../voice.types.js";

export class VoiceProcessor {
  async run(input: VoiceInput): Promise<VoiceOutput> {
    if (input.op === "route_profile") {
      return {
        voiceProfile: input.voiceProfile,
        lane: input.lane,
        routed: true
      };
    }

    return {
      streamId: `voice_${Date.now()}`,
      voiceProfile: input.voiceProfile,
      synthesized: true
    };
  }
}
