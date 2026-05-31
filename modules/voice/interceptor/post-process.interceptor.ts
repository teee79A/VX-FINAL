import { ResultEnvelope } from "../../../shared/result.types.js";

export function postProcessVoice<T>(result: ResultEnvelope<T>): ResultEnvelope<T> {
  return result;
}
