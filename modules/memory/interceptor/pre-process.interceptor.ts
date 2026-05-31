import { ModuleRequest } from "../../../shared/terminal.types.js";

export function preProcessMemory(
  request: ModuleRequest<unknown>
): ModuleRequest<unknown> {
  return request;
}
