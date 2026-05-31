import { ModuleRequest } from "../../../shared/terminal.types.js";

export function assertMemoryNoDirectExec(request: ModuleRequest<unknown>): void {
  if (request.action.startsWith("exec:")) {
    throw new Error("MEMORY_POLICY_DIRECT_EXEC_FORBIDDEN");
  }
}
