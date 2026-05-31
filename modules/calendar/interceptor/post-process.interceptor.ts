import { ResultEnvelope } from "../../../shared/result.types.js";

export function postProcessCalendar<T>(result: ResultEnvelope<T>): ResultEnvelope<T> {
  return result;
}
