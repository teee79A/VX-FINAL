import { VoiceModule } from "./voice.module.js";

export async function createVoiceModule(): Promise<VoiceModule> {
  const module = new VoiceModule();
  await module.init();
  return module;
}
