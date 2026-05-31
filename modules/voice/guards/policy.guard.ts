import { ModuleRequest } from "../../../shared/terminal.types.js";

export function assertVoiceNoDirectExec(request: ModuleRequest<unknown>): void {
  if (request.action.startsWith("exec:")) {
    throw new Error("VOICE_POLICY_DIRECT_EXEC_FORBIDDEN");
  }
}
