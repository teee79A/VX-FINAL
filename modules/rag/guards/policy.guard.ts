import { ModuleRequest } from "../../../shared/terminal.types.js";

export function assertRagNoDirectExec(request: ModuleRequest<unknown>): void {
  if (request.action.startsWith("exec:")) {
    throw new Error("RAG_POLICY_DIRECT_EXEC_FORBIDDEN");
  }
}
