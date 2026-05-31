export interface ResultEnvelope<T = unknown> {
  ok: boolean;
  module: string;
  requestId: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  audit: {
    startedAtUtc: string;
    finishedAtUtc: string;
    evidenceRef?: string;
  };
}
