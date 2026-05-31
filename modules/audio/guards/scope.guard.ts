import { ModuleRequest } from "../../../shared/terminal.types.js";

export function assertAudioScope(request: ModuleRequest<unknown>): void {
  if (!request.context.actorId) {
    throw new Error("AUDIO_SCOPE_ACTOR_REQUIRED");
  }
}
