import { ModuleRequest } from "../../../shared/terminal.types.js";

export function assertNoDirectExec(request: ModuleRequest<unknown>): void {
  if (request.action.startsWith("exec:")) {
    throw new Error("CALENDAR_POLICY_DIRECT_EXEC_FORBIDDEN");
  }
}
