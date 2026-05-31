import { RagModule } from "./rag.module.js";

export async function createRagModule(): Promise<RagModule> {
  const module = new RagModule();
  await module.init();
  return module;
}
