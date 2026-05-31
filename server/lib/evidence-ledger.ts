import { createHash } from "node:crypto";
import type { PoolClient } from "pg";

export interface EvidenceLedgerInput {
  evidenceRef: string;
  eventType: string;
  actor: string;
  payload: Record<string, unknown>;
  txHash?: string | null;
  blockNumber?: number | null;
}

export interface EvidenceLedgerResult {
  evidenceRef: string;
  chainHash: string;
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);

  const record = value as Record<string, unknown>;
  return Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortKeys(record[key]);
      return acc;
    }, {});
}

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function canonicalJson(payload: Record<string, unknown>): string {
  return JSON.stringify(sortKeys(payload));
}

export async function appendEvidenceLedgerTx(
  client: PoolClient,
  input: EvidenceLedgerInput,
): Promise<EvidenceLedgerResult> {
  const previous = await client.query<{ chain_hash: string }>(
    "SELECT chain_hash FROM evidence_ledger ORDER BY id DESC LIMIT 1",
  );
  const prevHash = previous.rows[0]?.chain_hash ?? "GENESIS";

  const payloadJson = canonicalJson(input.payload);
  const payloadHash = sha256(payloadJson);
  const chainHash = sha256(`${prevHash}:${payloadHash}:${input.eventType}:${input.evidenceRef}`);

  await client.query(
    `INSERT INTO evidence_ledger
       (evidence_ref, event_type, actor, payload, payload_hash, prev_hash, chain_hash, tx_hash, block_number, created_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, now())`,
    [
      input.evidenceRef,
      input.eventType,
      input.actor,
      payloadJson,
      payloadHash,
      prevHash,
      chainHash,
      input.txHash ?? null,
      input.blockNumber ?? null,
    ],
  );

  return {
    evidenceRef: input.evidenceRef,
    chainHash,
  };
}

