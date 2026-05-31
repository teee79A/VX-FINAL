import { MemoryModule } from "./memory.module.js";

export async function createMemoryModule(): Promise<MemoryModule> {
  const module = new MemoryModule();
  await module.init();
  return module;
}
