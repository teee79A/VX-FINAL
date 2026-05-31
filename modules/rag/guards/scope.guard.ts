import { ModuleRequest } from "../../../shared/terminal.types.js";

export function assertRagScope(request: ModuleRequest<unknown>): void {
  if (!request.context.actorId) {
    throw new Error("RAG_SCOPE_ACTOR_REQUIRED");
  }
}
