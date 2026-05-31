import { ModuleRequest } from "../../../shared/terminal.types.js";

export function assertMemoryScope(request: ModuleRequest<unknown>): void {
  if (!request.context.actorId) {
    throw new Error("MEMORY_SCOPE_ACTOR_REQUIRED");
  }
}
