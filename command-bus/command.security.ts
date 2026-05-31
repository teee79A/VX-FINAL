import { createHash, randomBytes } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function generateNonce(): string {
  return randomBytes(32).toString("hex");
}

export function generateCommandId(): string {
  const timestamp = BigInt(Date.now());
  const random = randomBytes(10);

  const bytes = new Uint8Array(16);
  // 48-bit unix epoch milliseconds, big-endian.
  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);

  // Version 7 (0111xxxx).
  bytes[6] = 0x70 | (random[0]! & 0x0f);
  bytes[7] = random[1]!;

  // Variant 10xxxxxx.
  bytes[8] = 0x80 | (random[2]! & 0x3f);
  bytes[9] = random[3]!;
  bytes[10] = random[4]!;
  bytes[11] = random[5]!;
  bytes[12] = random[6]!;
  bytes[13] = random[7]!;
  bytes[14] = random[8]!;
  bytes[15] = random[9]!;

  const hex = Buffer.from(bytes).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export function stableStringify(input: unknown): string {
  return JSON.stringify(sortValue(input));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      out[key] = sortValue(obj[key]);
    }
    return out;
  }
  return value;
}

export function buildFingerprint(params: {
  actor_id: string;
  intent: string;
  payload_hash: string;
  idempotency_key: string;
}): string {
  return sha256(
    `${params.actor_id}:${params.intent}:${params.payload_hash}:${params.idempotency_key}`,
  );
}
