import { ResultEnvelope } from "../../../shared/result.types.js";

export function postProcessAudio<T>(result: ResultEnvelope<T>): ResultEnvelope<T> {
  return result;
}
