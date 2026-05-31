import { ModuleRequest } from "../../../shared/terminal.types.js";

export function preProcessVoice(
  request: ModuleRequest<unknown>
): ModuleRequest<unknown> {
  return request;
}
