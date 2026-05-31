import { ResultEnvelope } from "../shared/result.types.js";

export function okResult<T>(
  module: string,
  requestId: string,
  data: T,
  startedAtUtc: string,
  evidenceRef?: string,
): ResultEnvelope<T> {
  return {
    ok: true,
    module,
    requestId,
    data,
    audit: {
      startedAtUtc,
      finishedAtUtc: new Date().toISOString(),
      ...(evidenceRef ? { evidenceRef } : {}),
    },
  };
}

export function errorResult(
  module: string,
  requestId: string,
  code: string,
  message: string,
  startedAtUtc: string,
): ResultEnvelope<never> {
  return {
    ok: false,
    module,
    requestId,
    error: {
      code,
      message,
      retryable: false,
    },
    audit: {
      startedAtUtc,
      finishedAtUtc: new Date().toISOString(),
    },
  };
}
