import { ModuleRequest } from "../../../shared/terminal.types.js";

export function assertReportsNoDirectExec(request: ModuleRequest<unknown>): void {
  if (request.action.startsWith("exec:")) {
    throw new Error("REPORTS_POLICY_DIRECT_EXEC_FORBIDDEN");
  }
}
