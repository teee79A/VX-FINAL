import { AudioModule } from "./audio.module.js";

export async function createAudioModule(): Promise<AudioModule> {
  const module = new AudioModule();
  await module.init();
  return module;
}
