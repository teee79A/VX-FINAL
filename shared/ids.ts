import crypto from "node:crypto";

export function makeRequestId(prefix = "req"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function makeCorrelationId(prefix = "corr"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
