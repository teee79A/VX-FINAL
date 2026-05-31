import { ResultEnvelope } from "../../../shared/result.types.js";

export function postProcessRag<T>(result: ResultEnvelope<T>): ResultEnvelope<T> {
  return result;
}
