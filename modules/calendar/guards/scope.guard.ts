import { ModuleRequest } from "../../../shared/terminal.types.js";

export function assertCalendarScope(request: ModuleRequest<unknown>): void {
  if (!request.context.actorId) {
    throw new Error("CALENDAR_SCOPE_ACTOR_REQUIRED");
  }
}
