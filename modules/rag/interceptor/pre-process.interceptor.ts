import { ModuleRequest } from "../../../shared/terminal.types.js";

export function preProcessRag(
  request: ModuleRequest<unknown>
): ModuleRequest<unknown> {
  return request;
}
