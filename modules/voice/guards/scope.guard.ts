import { ModuleRequest } from "../../../shared/terminal.types.js";

export function assertVoiceScope(request: ModuleRequest<unknown>): void {
  if (!request.context.actorId) {
    throw new Error("VOICE_SCOPE_ACTOR_REQUIRED");
  }
}
