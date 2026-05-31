import { ModuleRequest } from "../../../shared/terminal.types.js";

export function preProcessReports(
  request: ModuleRequest<unknown>
): ModuleRequest<unknown> {
  return request;
}
