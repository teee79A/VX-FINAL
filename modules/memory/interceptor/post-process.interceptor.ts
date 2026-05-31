import { ResultEnvelope } from "../../../shared/result.types.js";

export function postProcessMemory<T>(result: ResultEnvelope<T>): ResultEnvelope<T> {
  return result;
}
