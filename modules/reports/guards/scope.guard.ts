import { ModuleRequest } from "../../../shared/terminal.types.js";

export function assertReportsScope(request: ModuleRequest<unknown>): void {
  if (!request.context.actorId) {
    throw new Error("REPORTS_SCOPE_ACTOR_REQUIRED");
  }
}
