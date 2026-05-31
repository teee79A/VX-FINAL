/**
 * Evidence Room — API Surface
 *
 * All /api/evidence/* endpoints.
 * Backed by Postgres: evidence_events, evidence_exports.
 * Cross-linked to receipts, stamps, and customers.
 */

import type { FastifyInstance } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import { query, queryOne } from "../db.js";
import {
  getPhase2CommercialReceiptDetail,
  getPhase2EvidenceManifestDetail,
  getPhase2EvidenceProofByHash,
  getPhase2EvidenceProofByReceipt,
  getPhase2EvidenceStatus,
  isPhase2SliceEnabled,
  listPhase2CommercialReceipts,
} from "../lib/phase2-slice.js";

// ── TYPES ─────────────────────────────────────────────────────────────────

interface EvidenceEventRow {
  id: string;
  event_type: string;
  room: string;
  service: string;
  customer_id: string | null;
  execution_id: string | null;
  receipt_id: string | null;
  stamp_id: string | null;
  payload: Record<string, unknown>;
  payload_digest: string;
  event_hash: string;
  prev_hash: string;
  chain_hash: string;
  signed: boolean;
  verified: boolean;
  created_at: string;
}

interface EvidenceExportRow {
  id: string;
  customer_id: string | null;
  scope: Record<string, unknown>;
  export_path: string;
  created_at: string;
}

// ── HELPERS ───────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function toPositiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

// ── REGISTER ──────────────────────────────────────────────────────────────

export async function registerEvidenceRoutes(server: FastifyInstance): Promise<void> {

  // GET /api/evidence/proofs
  // Canonical proof-chain list for room binding:
  // receipt -> hash/event -> manifest -> attestation
  server.get<{ Querystring: { page?: string; limit?: string } }>("/api/evidence/proofs", async (req, reply) => {
    if (!isPhase2SliceEnabled()) {
      return reply.code(503).send({
        error: "phase2_slice_required",
        message: "Evidence proof list is bound to canonical phase-2 backend and cannot use local fallback.",
      });
    }

    try {
      const page = toPositiveInt(req.query.page, 1, 10_000);
      const limit = toPositiveInt(req.query.limit, 20, 100);
      const receiptList = await listPhase2CommercialReceipts(page, limit);

      const chains = await Promise.all(
        (receiptList.receipts ?? []).map(async (receipt) => {
          try {
            const proof = await getPhase2EvidenceProofByReceipt(receipt.receiptId);
            const manifestId = proof.manifestId != null ? String(proof.manifestId) : null;
            const manifestDetail = manifestId
              ? await getPhase2EvidenceManifestDetail(manifestId).catch(() => null)
              : null;

            return {
              chain_id: receipt.receiptId,
              receipt_id: receipt.receiptId,
              order_id: receipt.orderId,
              customer_id: receipt.customerId,
              email: receipt.email,
              amount_cents: receipt.amount,
              currency: receipt.currency,
              issued_at: receipt.issuedAt,
              record_hash: proof.recordHash ?? null,
              event_hash: proof.eventHash ?? null,
              artifact_hash: proof.artifactHash ?? null,
              manifest_id: proof.manifestId ?? null,
              manifest_hash: proof.manifestHash ?? manifestDetail?.manifest?.manifestHash ?? null,
              signer_id: manifestDetail?.attestation?.signerId ?? proof.signerId ?? null,
              signature: manifestDetail?.attestation?.signature ?? proof.signature ?? null,
              attested_at: manifestDetail?.attestation?.attestedAt ?? proof.timestamp ?? null,
              chain_status: proof.manifestId
                ? (manifestDetail?.attestation?.signature || proof.signature ? "sealed_attested" : "sealed_unattested")
                : "hash_only",
              refs: {
                receipt_detail: `/api/commercial/receipts/${encodeURIComponent(receipt.receiptId)}`,
                proof_by_receipt: `/api/evidence/proof/receipt/${encodeURIComponent(receipt.receiptId)}`,
                proof_by_hash: proof.recordHash
                  ? `/api/evidence/proof/hash/${encodeURIComponent(proof.recordHash)}`
                  : null,
                manifest_detail: proof.manifestId
                  ? `/api/evidence/manifests/${encodeURIComponent(String(proof.manifestId))}`
                  : null,
              },
            };
          } catch {
            return {
              chain_id: receipt.receiptId,
              receipt_id: receipt.receiptId,
              order_id: receipt.orderId,
              customer_id: receipt.customerId,
              email: receipt.email,
              amount_cents: receipt.amount,
              currency: receipt.currency,
              issued_at: receipt.issuedAt,
              record_hash: null,
              event_hash: null,
              artifact_hash: null,
              manifest_id: null,
              manifest_hash: null,
              signer_id: null,
              signature: null,
              attested_at: null,
              chain_status: "missing_proof",
              refs: {
                receipt_detail: `/api/commercial/receipts/${encodeURIComponent(receipt.receiptId)}`,
                proof_by_receipt: `/api/evidence/proof/receipt/${encodeURIComponent(receipt.receiptId)}`,
                proof_by_hash: null,
                manifest_detail: null,
              },
            };
          }
        }),
      );

      return {
        source: "phase2",
        chains,
        pagination: receiptList.pagination ?? null,
      };
    } catch (error) {
      req.log.error({ err: error }, "phase2 proof chain list fetch failed");
      return reply.code(503).send({
        error: "phase2_proof_chain_list_unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/evidence/proof/receipt/:receiptId
  server.get<{ Params: { receiptId: string } }>("/api/evidence/proof/receipt/:receiptId", async (req, reply) => {
    const { receiptId } = req.params;

    if (!isPhase2SliceEnabled()) {
      return reply.code(503).send({
        error: "phase2_slice_required",
        message: "Proof lookup by receipt is bound to canonical phase-2 backend and cannot use local fallback.",
      });
    }

    try {
      const [proof, receiptDetail] = await Promise.all([
        getPhase2EvidenceProofByReceipt(receiptId),
        getPhase2CommercialReceiptDetail(receiptId).catch(() => null),
      ]);
      const manifestId = proof.manifestId != null ? String(proof.manifestId) : null;
      const manifest = manifestId
        ? await getPhase2EvidenceManifestDetail(manifestId).catch(() => null)
        : null;

      return {
        source: "phase2",
        proof,
        receipt: receiptDetail?.receipt ?? null,
        order: receiptDetail?.order ?? null,
        manifest: manifest?.manifest ?? null,
        attestation: manifest?.attestation ?? null,
        chain: {
          receipt_ref: `/api/commercial/receipts/${encodeURIComponent(receiptId)}`,
          proof_ref: `/api/evidence/proof/receipt/${encodeURIComponent(receiptId)}`,
          proof_hash_ref: proof.recordHash
            ? `/api/evidence/proof/hash/${encodeURIComponent(proof.recordHash)}`
            : null,
          manifest_ref: manifestId
            ? `/api/evidence/manifests/${encodeURIComponent(manifestId)}`
            : null,
        },
      };
    } catch (error) {
      req.log.error({ err: error, receiptId }, "phase2 proof by receipt fetch failed");
      return reply.code(503).send({
        error: "phase2_proof_by_receipt_unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/evidence/proof/hash/:recordHash
  server.get<{ Params: { recordHash: string } }>("/api/evidence/proof/hash/:recordHash", async (req, reply) => {
    const { recordHash } = req.params;

    if (!isPhase2SliceEnabled()) {
      return reply.code(503).send({
        error: "phase2_slice_required",
        message: "Proof lookup by hash is bound to canonical phase-2 backend and cannot use local fallback.",
      });
    }

    try {
      const proof = await getPhase2EvidenceProofByHash(recordHash);
      const manifestId = proof.manifestId != null ? String(proof.manifestId) : null;
      const manifest = manifestId
        ? await getPhase2EvidenceManifestDetail(manifestId).catch(() => null)
        : null;

      return {
        source: "phase2",
        proof,
        manifest: manifest?.manifest ?? null,
        attestation: manifest?.attestation ?? null,
        chain: {
          receipt_ref: proof.entityType === "receipt"
            ? `/api/commercial/receipts/${encodeURIComponent(proof.entityId)}`
            : null,
          proof_ref: `/api/evidence/proof/hash/${encodeURIComponent(recordHash)}`,
          proof_receipt_ref: proof.entityType === "receipt"
            ? `/api/evidence/proof/receipt/${encodeURIComponent(proof.entityId)}`
            : null,
          manifest_ref: manifestId
            ? `/api/evidence/manifests/${encodeURIComponent(manifestId)}`
            : null,
        },
      };
    } catch (error) {
      req.log.error({ err: error, recordHash }, "phase2 proof by hash fetch failed");
      return reply.code(503).send({
        error: "phase2_proof_by_hash_unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/evidence/manifests/:manifestId
  server.get<{ Params: { manifestId: string } }>("/api/evidence/manifests/:manifestId", async (req, reply) => {
    const { manifestId } = req.params;

    if (!isPhase2SliceEnabled()) {
      return reply.code(503).send({
        error: "phase2_slice_required",
        message: "Manifest detail is bound to canonical phase-2 backend and cannot use local fallback.",
      });
    }

    try {
      const manifest = await getPhase2EvidenceManifestDetail(manifestId);
      return {
        source: "phase2",
        ...manifest,
      };
    } catch (error) {
      req.log.error({ err: error, manifestId }, "phase2 manifest detail fetch failed");
      return reply.code(503).send({
        error: "phase2_manifest_detail_unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/evidence/chains/:receiptId
  server.get<{ Params: { receiptId: string } }>("/api/evidence/chains/:receiptId", async (req, reply) => {
    const { receiptId } = req.params;

    if (!isPhase2SliceEnabled()) {
      return reply.code(503).send({
        error: "phase2_slice_required",
        message: "Proof chain continuity is bound to canonical phase-2 backend and cannot use local fallback.",
      });
    }

    try {
      const [receipt, proofPayload] = await Promise.all([
        getPhase2CommercialReceiptDetail(receiptId),
        getPhase2EvidenceProofByReceipt(receiptId),
      ]);
      const manifestId = proofPayload.manifestId != null ? String(proofPayload.manifestId) : null;
      const manifest = manifestId
        ? await getPhase2EvidenceManifestDetail(manifestId).catch(() => null)
        : null;

      return {
        source: "phase2",
        chain: {
          receipt: receipt.receipt,
          order: receipt.order ?? null,
          proof: proofPayload,
          manifest: manifest?.manifest ?? null,
          attestation: manifest?.attestation ?? null,
        },
        refs: {
          receipt_detail: `/api/commercial/receipts/${encodeURIComponent(receiptId)}`,
          proof_by_receipt: `/api/evidence/proof/receipt/${encodeURIComponent(receiptId)}`,
          proof_by_hash: proofPayload.recordHash
            ? `/api/evidence/proof/hash/${encodeURIComponent(proofPayload.recordHash)}`
            : null,
          manifest_detail: manifestId
            ? `/api/evidence/manifests/${encodeURIComponent(manifestId)}`
            : null,
        },
      };
    } catch (error) {
      req.log.error({ err: error, receiptId }, "proof chain lookup failed");
      return reply.code(503).send({
        error: "phase2_proof_chain_unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/evidence/summary
  server.get("/api/evidence/summary", async (req, reply) => {
    if (isPhase2SliceEnabled()) {
      try {
        const statusPayload = await getPhase2EvidenceStatus();
        const totals = (statusPayload["totals"] ?? {}) as Record<string, unknown>;
        const total = Number(totals["evidenceJournal"] ?? 0);
        const manifests = Number(totals["manifests"] ?? 0);
        const attestations = Number(totals["attestations"] ?? 0);

        return {
          source: "phase2",
          total: Number.isFinite(total) ? total : 0,
          eventTypes: 0,
          signed: Number.isFinite(attestations) ? attestations : 0,
          verified: Number.isFinite(attestations) ? attestations : 0,
          receiptLinked: 0,
          stampLinked: 0,
          customersCovered: 0,
          signedPct: Number.isFinite(total) && total > 0 && Number.isFinite(attestations)
            ? Math.round((attestations / total) * 100)
            : 0,
          verifiedPct: Number.isFinite(total) && total > 0 && Number.isFinite(attestations)
            ? Math.round((attestations / total) * 100)
            : 0,
          chainHead: {
            hash: null,
            chainHash: null,
            at: null,
          },
          manifests: Number.isFinite(manifests) ? manifests : 0,
          attestations: Number.isFinite(attestations) ? attestations : 0,
        };
      } catch (error) {
        req.log.error({ err: error }, "phase2 evidence summary fetch failed");
        return reply.code(503).send({
          error: "phase2_evidence_summary_unavailable",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    interface EvidenceStats {
      total: string;
      event_types: string;
      signed_count: string;
      verified_count: string;
      receipt_linked: string;
      stamp_linked: string;
      customers_covered: string;
    }

    const [s, chainHead] = await Promise.all([
      queryOne<EvidenceStats>(`
        SELECT
          COUNT(*)::text AS total,
          COUNT(DISTINCT event_type)::text AS event_types,
          COUNT(*) FILTER (WHERE signed = true)::text AS signed_count,
          COUNT(*) FILTER (WHERE verified = true)::text AS verified_count,
          COUNT(*) FILTER (WHERE receipt_id IS NOT NULL)::text AS receipt_linked,
          COUNT(*) FILTER (WHERE stamp_id IS NOT NULL)::text AS stamp_linked,
          COUNT(DISTINCT customer_id)::text AS customers_covered
        FROM evidence_events
      `),
      queryOne<{ event_hash: string; chain_hash: string; created_at: string }>(
        "SELECT event_hash, chain_hash, created_at FROM evidence_events ORDER BY created_at DESC LIMIT 1",
      ),
    ]);

    if (!s) return { total: 0, eventTypes: 0, signed: 0, verified: 0, receiptLinked: 0, stampLinked: 0, customersCovered: 0, signedPct: 0, verifiedPct: 0, chainHead: null };
    const total = parseInt(s.total);

    return {
      total,
      eventTypes: parseInt(s.event_types),
      signed: parseInt(s.signed_count),
      verified: parseInt(s.verified_count),
      receiptLinked: parseInt(s.receipt_linked),
      stampLinked: parseInt(s.stamp_linked),
      customersCovered: parseInt(s.customers_covered),
      signedPct: total > 0 ? Math.round(parseInt(s.signed_count) / total * 100) : 0,
      verifiedPct: total > 0 ? Math.round(parseInt(s.verified_count) / total * 100) : 0,
      chainHead: chainHead ? {
        hash: chainHead.event_hash,
        chainHash: chainHead.chain_hash,
        at: chainHead.created_at,
      } : null,
      source: "local",
    };
  });

  // GET /api/evidence/events
  server.get<{ Querystring: { limit?: string; room?: string; type?: string; customerId?: string } }>(
    "/api/evidence/events",
    async (req) => {
      const limit = Math.min(parseInt(req.query.limit ?? "50"), 200);
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (req.query.room) {
        conditions.push(`room = $${idx++}`);
        params.push(req.query.room);
      }
      if (req.query.type) {
        conditions.push(`event_type = $${idx++}`);
        params.push(req.query.type);
      }
      if (req.query.customerId) {
        conditions.push(`customer_id = $${idx++}`);
        params.push(req.query.customerId);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      params.push(limit);

      const rows = await query<EvidenceEventRow>(
        `SELECT * FROM evidence_events ${where} ORDER BY created_at DESC LIMIT $${idx}`,
        params,
      );
      return { events: rows, count: rows.length };
    },
  );

  // GET /api/evidence/events/:eventId
  server.get<{ Params: { eventId: string } }>("/api/evidence/events/:eventId", async (req, reply) => {
    const event = await queryOne<EvidenceEventRow>(
      "SELECT * FROM evidence_events WHERE id = $1",
      [req.params.eventId],
    );
    if (!event) return reply.code(404).send({ error: "Event not found" });
    return { event };
  });

  // GET /api/evidence/chain/head
  server.get("/api/evidence/chain/head", async () => {
    const head = await queryOne<EvidenceEventRow>(
      "SELECT * FROM evidence_events ORDER BY created_at DESC LIMIT 1",
    );
    return { head: head ?? null };
  });

  // GET /api/evidence/chain/verify
  server.get<{ Querystring: { limit?: string } }>("/api/evidence/chain/verify", async (req) => {
    const limit = Math.min(parseInt(req.query.limit ?? "100"), 1000);
    const rows = await query<{ event_hash: string; prev_hash: string; chain_hash: string; created_at: string }>(
      "SELECT event_hash, prev_hash, chain_hash, created_at FROM evidence_events ORDER BY created_at ASC LIMIT $1",
      [limit],
    );

    let valid = true;
    let brokenAt: number | null = null;
    const GENESIS = "GENESIS";

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      if (i === 0) {
        if (row.prev_hash !== GENESIS) {
          valid = false;
          brokenAt = 0;
          break;
        }
      } else {
        const prev = rows[i - 1]!;
        if (row.prev_hash !== prev.event_hash) {
          valid = false;
          brokenAt = i;
          break;
        }
      }
      const expectedChain = sha256(`${row.prev_hash}:${row.event_hash}`);
      if (row.chain_hash !== expectedChain) {
        valid = false;
        brokenAt = i;
        break;
      }
    }

    return {
      verified: valid,
      chainLength: rows.length,
      brokenAt,
      head: rows.length > 0 ? rows[rows.length - 1]!.event_hash : null,
    };
  });

  // GET /api/evidence/customer/:customerId
  server.get<{ Params: { customerId: string } }>("/api/evidence/customer/:customerId", async (req, reply) => {
    const { customerId } = req.params;
    const customer = await queryOne<{ id: string; company_name: string }>(
      "SELECT id, company_name FROM customers WHERE id = $1",
      [customerId],
    );
    if (!customer) return reply.code(404).send({ error: "Customer not found" });

    const events = await query<EvidenceEventRow>(
      "SELECT * FROM evidence_events WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 100",
      [customerId],
    );

    const stats = await query<Record<string, string>>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE signed)::text AS signed,
        COUNT(*) FILTER (WHERE verified)::text AS verified,
        COUNT(*) FILTER (WHERE receipt_id IS NOT NULL)::text AS receipt_linked,
        COUNT(*) FILTER (WHERE stamp_id IS NOT NULL)::text AS stamp_linked
      FROM evidence_events WHERE customer_id = $1
    `, [customerId]);

    return {
      customer,
      events,
      stats: stats[0],
    };
  });

  // GET /api/evidence/receipts/:receiptId
  server.get<{ Params: { receiptId: string } }>("/api/evidence/receipts/:receiptId", async (req, reply) => {
    const receipt = await queryOne<{
      id: string;
      invoice_id: string;
      customer_id: string;
      evidence_hash: string;
      execution_summary: Record<string, unknown>;
      amount_cents: string;
      currency: string;
      issued_at: string;
    }>("SELECT * FROM receipts WHERE id = $1", [req.params.receiptId]);

    if (!receipt) return reply.code(404).send({ error: "Receipt not found" });

    const linkedEvidence = await query<EvidenceEventRow>(
      "SELECT * FROM evidence_events WHERE receipt_id = $1 ORDER BY created_at DESC",
      [req.params.receiptId],
    );

    return { receipt, linkedEvidence };
  });

  // GET /api/evidence/stamps/:stampId
  server.get<{ Params: { stampId: string } }>("/api/evidence/stamps/:stampId", async (req, reply) => {
    const stamp = await queryOne<{
      id: string;
      customer_id: string;
      state: string;
      summary: Record<string, unknown>;
      evidence_hash: string;
      stamped_at: string;
    }>("SELECT * FROM stamps WHERE id = $1", [req.params.stampId]);

    if (!stamp) return reply.code(404).send({ error: "Stamp not found" });

    const linkedEvidence = await query<EvidenceEventRow>(
      "SELECT * FROM evidence_events WHERE stamp_id = $1 ORDER BY created_at DESC",
      [req.params.stampId],
    );

    return { stamp, linkedEvidence };
  });

  // POST /api/evidence/export
  server.post<{ Body: { customerId?: string; room?: string; startDate?: string; endDate?: string } }>(
    "/api/evidence/export",
    async (req, reply) => {
      const { customerId, room, startDate, endDate } = req.body as {
        customerId?: string;
        room?: string;
        startDate?: string;
        endDate?: string;
      };

      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (customerId) {
        conditions.push(`customer_id = $${idx++}`);
        params.push(customerId);
      }
      if (room) {
        conditions.push(`room = $${idx++}`);
        params.push(room);
      }
      if (startDate) {
        conditions.push(`created_at >= $${idx++}`);
        params.push(startDate);
      }
      if (endDate) {
        conditions.push(`created_at < $${idx++}`);
        params.push(endDate);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const events = await query<EvidenceEventRow>(
        `SELECT * FROM evidence_events ${where} ORDER BY created_at ASC`,
        params,
      );

      const scope = { customerId, room, startDate, endDate };
      const exportId = randomUUID();
      const exportPath = `exports/${exportId}.json`;

      await query(
        `INSERT INTO evidence_exports (id, customer_id, scope, export_path) VALUES ($1, $2, $3, $4)`,
        [exportId, customerId ?? null, JSON.stringify(scope), exportPath],
      );

      return reply.code(201).send({
        exportId,
        scope,
        eventCount: events.length,
        events,
      });
    },
  );

  // GET /api/evidence/seals
  server.get("/api/evidence/seals", async () => {
    const seals = await query<{
      id: string;
      workspace_id: string;
      actor_id: string;
      title: string;
      subject: string;
      payload_sha256: string;
      status: string;
      created_at: string;
      proof_id: string | null;
      proof_url: string | null;
    }>(`
      SELECT s.id,
             s.workspace_id,
             s.actor_id,
             s.title,
             s.subject,
             s.payload_sha256,
             s.status,
             s.created_at::text AS created_at,
             p.id AS proof_id,
             p.proof_url
      FROM seals s
      LEFT JOIN proofs p ON p.seal_id = s.id
      ORDER BY s.created_at DESC
      LIMIT 200
    `);

    return {
      seals,
      source: "primary_db",
    };
  });

  // GET /api/evidence/seals/:sealId
  server.get<{ Params: { sealId: string } }>("/api/evidence/seals/:sealId", async (req, reply) => {
    const sealId = req.params.sealId.trim();
    if (!sealId) return reply.code(400).send({ error: "seal_id_required" });

    const seal = await queryOne<{
      id: string;
      workspace_id: string;
      actor_id: string;
      title: string;
      subject: string;
      description: string | null;
      payload_sha256: string;
      status: string;
      created_at: string;
      proof_id: string | null;
      proof_url: string | null;
    }>(`
      SELECT s.id,
             s.workspace_id,
             s.actor_id,
             s.title,
             s.subject,
             s.description,
             s.payload_sha256,
             s.status,
             s.created_at::text AS created_at,
             p.id AS proof_id,
             p.proof_url
      FROM seals s
      LEFT JOIN proofs p ON p.seal_id = s.id
      WHERE s.id = $1
      LIMIT 1
    `, [sealId]);
    if (!seal) return reply.code(404).send({ error: "seal_not_found" });

    const [events, exports] = await Promise.all([
      query<{
        id: string;
        event_type: string;
        created_at: string;
      }>(`
        SELECT id,
               event_type,
               created_at::text AS created_at
        FROM seal_events
        WHERE seal_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [sealId]),
      query<{
        id: string;
        export_path: string;
        created_at: string;
      }>(`
        SELECT id::text AS id,
               export_path,
               created_at::text AS created_at
        FROM evidence_exports
        ORDER BY created_at DESC
        LIMIT 20
      `),
    ]);

    return {
      seal,
      linked_chain: {
        proof_ref: seal.proof_id ? `/api/evidence/proofs/${encodeURIComponent(seal.proof_id)}` : null,
        seal_events: events.map((event) => ({
          id: event.id,
          detail_api: `/api/evidence/events/${encodeURIComponent(event.id)}`,
        })),
        export_refs: exports.map((entry) => `/api/evidence/exports/${encodeURIComponent(entry.id)}`),
      },
      evidence_refs: [seal.payload_sha256],
      actions: ["verify", "revoke", "export"],
    };
  });

  // GET /api/evidence/exports
  server.get("/api/evidence/exports", async () => {
    const exports = await query<EvidenceExportRow & { id: string; created_at: string }>(`
      SELECT id::text AS id,
             customer_id,
             scope,
             export_path,
             created_at::text AS created_at
      FROM evidence_exports
      ORDER BY created_at DESC
      LIMIT 200
    `);
    return { exports };
  });

  // GET /api/evidence/exports/:exportId
  server.get<{ Params: { exportId: string } }>("/api/evidence/exports/:exportId", async (req, reply) => {
    const exportId = req.params.exportId.trim();
    if (!exportId) return reply.code(400).send({ error: "export_id_required" });

    const exportRecord = await queryOne<{
      id: string;
      customer_id: string | null;
      scope: Record<string, unknown>;
      export_path: string;
      created_at: string;
    }>(`
      SELECT id::text AS id,
             customer_id,
             scope,
             export_path,
             created_at::text AS created_at
      FROM evidence_exports
      WHERE id::text = $1
      LIMIT 1
    `, [exportId]);
    if (!exportRecord) return reply.code(404).send({ error: "export_not_found" });

    const scope = exportRecord.scope ?? {};
    const room = typeof scope["room"] === "string" ? String(scope["room"]) : undefined;
    const customerId = exportRecord.customer_id ?? (typeof scope["customerId"] === "string" ? String(scope["customerId"]) : undefined);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (room) {
      conditions.push(`room = $${idx++}`);
      params.push(room);
    }
    if (customerId) {
      conditions.push(`customer_id = $${idx++}`);
      params.push(customerId);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const linkedEvents = await query<{
      id: string;
      event_type: string;
      event_hash: string;
      created_at: string;
    }>(`
      SELECT id,
             event_type,
             event_hash,
             created_at::text AS created_at
      FROM evidence_events
      ${where}
      ORDER BY created_at DESC
      LIMIT 200
    `, params);

    return {
      export: exportRecord,
      linked_events: linkedEvents,
      actions: ["verify", "revoke"],
    };
  });

  // POST /api/evidence/seals/:sealId/verify
  server.post<{ Params: { sealId: string } }>("/api/evidence/seals/:sealId/verify", async (req, reply) => {
    const sealId = req.params.sealId.trim();
    const updated = await query<{ id: string; status: string }>(`
      UPDATE seals
         SET status = 'sealed'
       WHERE id = $1
       RETURNING id, status
    `, [sealId]);
    if (updated.length === 0) return reply.code(404).send({ error: "seal_not_found" });
    return { ok: true, action: "verify", seal: updated[0] };
  });

  // POST /api/evidence/seals/:sealId/revoke
  server.post<{ Params: { sealId: string } }>("/api/evidence/seals/:sealId/revoke", async (req, reply) => {
    const sealId = req.params.sealId.trim();
    const updated = await query<{ id: string; status: string }>(`
      UPDATE seals
         SET status = 'revoked'
       WHERE id = $1
       RETURNING id, status
    `, [sealId]);
    if (updated.length === 0) return reply.code(404).send({ error: "seal_not_found" });
    return { ok: true, action: "revoke", seal: updated[0] };
  });
}
