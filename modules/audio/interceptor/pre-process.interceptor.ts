import { ModuleRequest } from "../../../shared/terminal.types.js";

export function preProcessAudio(
  request: ModuleRequest<unknown>
): ModuleRequest<unknown> {
  return request;
}
