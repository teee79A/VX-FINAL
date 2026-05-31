import { ResultEnvelope } from "../../../shared/result.types.js";

export function postProcessReports<T>(
  result: ResultEnvelope<T>
): ResultEnvelope<T> {
  return result;
}
