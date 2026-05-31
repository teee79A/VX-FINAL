import { ModuleRequest } from "../../../shared/terminal.types.js";

export function assertAudioNoDirectExec(request: ModuleRequest<unknown>): void {
  if (request.action.startsWith("exec:")) {
    throw new Error("AUDIO_POLICY_DIRECT_EXEC_FORBIDDEN");
  }
}
