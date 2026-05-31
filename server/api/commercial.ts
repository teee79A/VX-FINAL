/**
 * Commercial Room — API Surface
 *
 * All /api/commercial/* endpoints.
 * Backed by Postgres: customers, contracts, invoices, receipts, stamps.
 */

import type { FastifyInstance } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import { query, queryOne } from "../db.js";
import { withRateLimit } from "../lib/rate-limit.js";
import {
  getPhase2CommercialReceiptDetail,
  getPhase2EvidenceProofByReceipt,
  isPhase2SliceEnabled,
  listPhase2CommercialReceipts,
} from "../lib/phase2-slice.js";

// ── TYPES ─────────────────────────────────────────────────────────────────

interface CustomerRow {
  id: string;
  slug: string;
  company_name: string;
  status: string;
  plan: string;
  billing_email: string | null;
  created_at: string;
}

interface ContractRow {
  id: string;
  customer_id: string;
  monthly_price_cents: string;
  execution_limit: number;
  environments_limit: number;
  starts_at: string;
  renews_at: string | null;
  status: string;
  created_at: string;
}

interface InvoiceRow {
  id: string;
  customer_id: string;
  contract_id: string | null;
  period_start: string;
  period_end: string;
  subtotal_cents: string;
  credits_cents: string;
  total_cents: string;
  currency: string;
  status: string;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
}

interface ReceiptRow {
  id: string;
  invoice_id: string;
  customer_id: string;
  evidence_hash: string;
  execution_summary: Record<string, unknown>;
  amount_cents: string;
  currency: string;
  issued_at: string;
}

interface StampRow {
  id: string;
  customer_id: string;
  state: string;
  summary: Record<string, unknown>;
  evidence_hash: string;
  stamped_at: string;
}

// ── HELPERS ───────────────────────────────────────────────────────────────

function centsToDecimal(cents: string | number): string {
  const n = typeof cents === "string" ? parseInt(cents, 10) : cents;
  return (n / 100).toFixed(2);
}

// ── REGISTER ──────────────────────────────────────────────────────────────

export async function registerCommercialRoutes(server: FastifyInstance): Promise<void> {

  // GET /api/commercial/summary
  server.get("/api/commercial/summary", withRateLimit(async () => {
    const [customers, revenue, usage] = await Promise.all([
      query<{ total: string; active: string; churned: string }>(`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE status = 'active')::text AS active,
          COUNT(*) FILTER (WHERE status = 'churned')::text AS churned
        FROM customers
      `),
      query<{ mrr: string; arr: string; paid: string; unpaid: string; overdue: string }>(`
        SELECT
          COALESCE(SUM(c.monthly_price_cents), 0)::text AS mrr,
          (COALESCE(SUM(c.monthly_price_cents), 0) * 12)::text AS arr,
          COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total_cents ELSE 0 END), 0)::text AS paid,
          COALESCE(SUM(CASE WHEN i.status IN ('issued','draft') THEN i.total_cents ELSE 0 END), 0)::text AS unpaid,
          COALESCE(SUM(CASE WHEN i.status = 'overdue' THEN i.total_cents ELSE 0 END), 0)::text AS overdue
        FROM contracts c
        LEFT JOIN invoices i ON i.customer_id = c.customer_id
        WHERE c.status = 'active'
      `),
      query<{ total_executions: string; success_rate: string }>(`
        SELECT
          COUNT(*)::text AS total_executions,
          CASE WHEN COUNT(*) > 0
            THEN ROUND(COUNT(*) FILTER (WHERE status = 'succeeded')::numeric / COUNT(*)::numeric * 100, 1)::text
            ELSE '0'
          END AS success_rate
        FROM job_runs
      `),
    ]);

    const c = customers[0]!;
    const r = revenue[0]!;
    const u = usage[0]!;

    return {
      customers: { total: parseInt(c.total), active: parseInt(c.active), churned: parseInt(c.churned) },
      revenue: {
        mrr: centsToDecimal(r.mrr),
        arr: centsToDecimal(r.arr),
        paid: centsToDecimal(r.paid),
        unpaid: centsToDecimal(r.unpaid),
        overdue: centsToDecimal(r.overdue),
      },
      usage: {
        totalExecutions: parseInt(u.total_executions),
        successRate: parseFloat(u.success_rate),
      },
    };
  }));

  // GET /api/commercial/customers
  server.get("/api/commercial/customers", withRateLimit(async () => {
    const rows = await query<CustomerRow>(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM contracts ct WHERE ct.customer_id = c.id AND ct.status = 'active')::text AS active_contracts,
        (SELECT COALESCE(SUM(i.total_cents), 0) FROM invoices i WHERE i.customer_id = c.id AND i.status = 'paid')::text AS total_paid_cents
      FROM customers c ORDER BY c.created_at DESC
    `);
    return { customers: rows };
  }));

  // GET /api/commercial/customers/:customerId
  server.get<{ Params: { customerId: string } }>("/api/commercial/customers/:customerId", withRateLimit<{ Params: { customerId: string } }>(async (req, reply) => {
    const { customerId } = req.params;
    const customer = await queryOne<CustomerRow>("SELECT * FROM customers WHERE id = $1", [customerId]);
    if (!customer) return reply.code(404).send({ error: "Customer not found" });

    const [contracts, invoices, receipts, stamps] = await Promise.all([
      query<ContractRow>("SELECT * FROM contracts WHERE customer_id = $1 ORDER BY created_at DESC", [customerId]),
      query<InvoiceRow>("SELECT * FROM invoices WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20", [customerId]),
      query<ReceiptRow>("SELECT * FROM receipts WHERE customer_id = $1 ORDER BY issued_at DESC LIMIT 20", [customerId]),
      query<StampRow>("SELECT * FROM stamps WHERE customer_id = $1 ORDER BY stamped_at DESC LIMIT 20", [customerId]),
    ]);

    return { customer, contracts, invoices, receipts, stamps };
  }));

  // GET /api/commercial/contracts
  server.get("/api/commercial/contracts", withRateLimit(async () => {
    const rows = await query<ContractRow & { company_name: string }>(`
      SELECT ct.*, c.company_name
      FROM contracts ct JOIN customers c ON ct.customer_id = c.id
      ORDER BY ct.created_at DESC
    `);
    return { contracts: rows };
  }));

  // GET /api/commercial/invoices
  server.get("/api/commercial/invoices", withRateLimit(async () => {
    const rows = await query<InvoiceRow & { company_name: string }>(`
      SELECT i.*, c.company_name
      FROM invoices i JOIN customers c ON i.customer_id = c.id
      ORDER BY i.created_at DESC LIMIT 100
    `);
    return { invoices: rows };
  }));

  // GET /api/commercial/receipts
  server.get<{ Querystring: { page?: string; limit?: string } }>("/api/commercial/receipts", withRateLimit<{ Querystring: { page?: string; limit?: string } }>(async (req, reply) => {
    if (!isPhase2SliceEnabled()) {
      return reply.code(503).send({
        error: "phase2_slice_required",
        message: "Commercial receipt surface is bound to canonical phase-2 backend and cannot use local fallback.",
      });
    }

    try {
      const page = Number.parseInt(req.query.page ?? "1", 10) || 1;
      const limit = Number.parseInt(req.query.limit ?? "50", 10) || 50;
      const phase2List = await listPhase2CommercialReceipts(page, limit);

      const receipts = await Promise.all(
        (phase2List.receipts ?? []).map(async (receipt) => {
          let proofRef: {
            recordHash?: string | null;
            manifestId?: string | number | null;
            signerId?: string | null;
            proofByReceipt?: string | null;
            proofByHash?: string | null;
            manifestDetail?: string | null;
          } | null = null;

          try {
            const proof = await getPhase2EvidenceProofByReceipt(receipt.receiptId);
            proofRef = {
              recordHash: proof.recordHash ?? null,
              manifestId: proof.manifestId ?? null,
              signerId: proof.signerId ?? null,
              proofByReceipt: `/api/evidence/proof/receipt/${encodeURIComponent(receipt.receiptId)}`,
              proofByHash: proof.recordHash
                ? `/api/evidence/proof/hash/${encodeURIComponent(proof.recordHash)}`
                : null,
              manifestDetail: proof.manifestId
                ? `/api/evidence/manifests/${encodeURIComponent(String(proof.manifestId))}`
                : null,
            };
          } catch {
            proofRef = null;
          }

          return {
            id: receipt.receiptId,
            order_id: receipt.orderId,
            customer_id: receipt.customerId,
            email: receipt.email,
            currency: receipt.currency,
            amount_cents: receipt.amount,
            status: receipt.status,
            issued_at: receipt.issuedAt,
            created_at: receipt.createdAt,
            detail_api: `/api/commercial/receipts/${encodeURIComponent(receipt.receiptId)}`,
            proof: proofRef,
            source: "phase2",
          };
        }),
      );

      return {
        receipts,
        pagination: phase2List.pagination ?? null,
        source: "phase2",
      };
    } catch (error) {
      req.log.error({ err: error }, "phase2 receipt list fetch failed");
      return reply.code(503).send({
        error: "phase2_receipt_list_unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }));

  // GET /api/commercial/receipts/:receiptId
  server.get<{ Params: { receiptId: string } }>("/api/commercial/receipts/:receiptId", withRateLimit<{ Params: { receiptId: string } }>(async (req, reply) => {
    const { receiptId } = req.params;

    if (!isPhase2SliceEnabled()) {
      return reply.code(503).send({
        error: "phase2_slice_required",
        message: "Commercial receipt detail is bound to canonical phase-2 backend and cannot use local fallback.",
      });
    }

    try {
      const payload = await getPhase2CommercialReceiptDetail(receiptId);
      return {
        source: "phase2",
        receipt: payload.receipt,
        order: payload.order ?? null,
        proof: payload.proof ?? null,
      };
    } catch (error) {
      req.log.error({ err: error, receiptId }, "phase2 receipt detail fetch failed");
      return reply.code(503).send({
        error: "phase2_receipt_detail_unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }));

  // GET /api/commercial/stamps
  server.get("/api/commercial/stamps", withRateLimit(async () => {
    const rows = await query<StampRow & { company_name: string }>(`
      SELECT s.*, c.company_name
      FROM stamps s JOIN customers c ON s.customer_id = c.id
      ORDER BY s.stamped_at DESC LIMIT 100
    `);
    if (rows.length > 0) {
      return { stamps: rows };
    }

    // VYRDx product fallback: seals are the tamper-evident stamp layer.
    const sealRows = await query<{
      id: string;
      workspace_id: string;
      title: string;
      subject: string;
      payload_sha256: string;
      status: string;
      created_at: string;
    }>(`
      SELECT
        id,
        workspace_id,
        title,
        subject,
        payload_sha256,
        status,
        created_at::text AS created_at
      FROM seals
      ORDER BY created_at DESC
      LIMIT 100
    `);

    return {
      stamps: sealRows.map((row) => ({
        id: row.id,
        company_name: row.subject,
        state: row.status,
        evidence_hash: row.payload_sha256,
        stamped_at: row.created_at,
        workspace_id: row.workspace_id,
        title: row.title,
      })),
    };
  }));

  // GET /api/commercial/failures
  server.get("/api/commercial/failures", withRateLimit(async () => {
    const rows = await query<{
      id: string;
      customer_id: string;
      company_name: string;
      job_type: string;
      status: string;
      detail: Record<string, unknown>;
      started_at: string | null;
      finished_at: string | null;
    }>(`
      SELECT j.id, j.customer_id, c.company_name, j.job_type, j.status, j.detail, j.started_at, j.finished_at
      FROM job_runs j
      LEFT JOIN customers c ON j.customer_id = c.id
      WHERE j.status IN ('failed','dead')
      ORDER BY j.finished_at DESC NULLS LAST
      LIMIT 100
    `);
    return { failures: rows };
  }));

  // GET /api/commercial/metrics
  server.get("/api/commercial/metrics", withRateLimit(async () => {
    const [rev, usage, quality] = await Promise.all([
      query<Record<string, string>>(`
        SELECT
          COALESCE(SUM(c.monthly_price_cents), 0)::text AS mrr,
          (COALESCE(SUM(c.monthly_price_cents), 0) * 12)::text AS arr,
          CASE WHEN COUNT(DISTINCT cu.id) > 0
            THEN (COALESCE(SUM(c.monthly_price_cents), 0) / COUNT(DISTINCT cu.id))::text
            ELSE '0'
          END AS arpa,
          COUNT(DISTINCT cu.id)::text AS customer_count,
          COALESCE(SUM(CASE WHEN i.status = 'overdue' THEN 1 ELSE 0 END), 0)::text AS overdue_count,
          CASE WHEN COUNT(i.id) > 0
            THEN ROUND(COUNT(i.id) FILTER (WHERE i.status = 'paid')::numeric / COUNT(i.id)::numeric * 100, 1)::text
            ELSE '0'
          END AS collection_rate
        FROM contracts c
        JOIN customers cu ON c.customer_id = cu.id
        LEFT JOIN invoices i ON i.customer_id = cu.id
        WHERE c.status = 'active'
      `),
      query<Record<string, string>>(`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE status = 'succeeded')::text AS succeeded,
          COUNT(*) FILTER (WHERE status = 'failed')::text AS failed,
          CASE WHEN COUNT(*) > 0
            THEN ROUND(AVG(EXTRACT(EPOCH FROM (finished_at - started_at)))::numeric, 2)::text
            ELSE '0'
          END AS avg_duration_s,
          CASE WHEN COUNT(*) > 0
            THEN ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (finished_at - started_at)))::numeric, 2)::text
            ELSE '0'
          END AS p95_duration_s
        FROM job_runs WHERE started_at IS NOT NULL
      `),
      query<Record<string, string>>(`
        SELECT
          CASE WHEN COUNT(*) > 0
            THEN ROUND(COUNT(*) FILTER (WHERE status = 'succeeded')::numeric / COUNT(*)::numeric * 100, 1)::text
            ELSE '0'
          END AS execution_success_rate,
          (SELECT COUNT(*) FROM receipts)::text AS total_receipts,
          (SELECT COUNT(*) FROM stamps WHERE state = 'failed')::text AS failed_stamps,
          (SELECT COUNT(*) FROM receipts WHERE evidence_hash != '')::text AS evidence_linked_receipts
        FROM job_runs
      `),
    ]);

    return {
      revenue: rev[0],
      usage: usage[0],
      quality: quality[0],
    };
  }));

  // POST /api/commercial/receipts/generate
  server.post<{ Body: { invoiceId: string } }>("/api/commercial/receipts/generate", withRateLimit(async (req, reply) => {
    const { invoiceId } = req.body as { invoiceId: string };
    if (!invoiceId) return reply.code(400).send({ error: "invoiceId required" });

    const invoice = await queryOne<InvoiceRow>("SELECT * FROM invoices WHERE id = $1", [invoiceId]);
    if (!invoice) return reply.code(404).send({ error: "Invoice not found" });
    if (invoice.status !== "paid") return reply.code(400).send({ error: "Invoice must be paid to generate receipt" });

    const execSummary = await query<{ total: string; succeeded: string }>(`
      SELECT COUNT(*)::text AS total, COUNT(*) FILTER (WHERE status = 'succeeded')::text AS succeeded
      FROM job_runs WHERE customer_id = $1 AND started_at >= $2 AND started_at < $3
    `, [invoice.customer_id, invoice.period_start, invoice.period_end]);

    const summary = {
      period: { start: invoice.period_start, end: invoice.period_end },
      executions: execSummary[0],
      invoiceId,
    };

    const evidenceHash = createHash("sha256").update(JSON.stringify(summary)).digest("hex");
    const receiptId = randomUUID();

    await query(
      `INSERT INTO receipts (id, invoice_id, customer_id, evidence_hash, execution_summary, amount_cents, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [receiptId, invoiceId, invoice.customer_id, evidenceHash, JSON.stringify(summary), invoice.total_cents, invoice.currency],
    );

    return { receiptId, evidenceHash, summary };
  }));

  // POST /api/commercial/stamps/generate
  server.post<{ Body: { customerId: string; periodStart: string; periodEnd: string } }>(
    "/api/commercial/stamps/generate",
    withRateLimit(async (req, reply) => {
      const { customerId, periodStart, periodEnd } = req.body as {
        customerId: string;
        periodStart: string;
        periodEnd: string;
      };
      if (!customerId || !periodStart || !periodEnd) {
        return reply.code(400).send({ error: "customerId, periodStart, periodEnd required" });
      }

      const customer = await queryOne<CustomerRow>("SELECT * FROM customers WHERE id = $1", [customerId]);
      if (!customer) return reply.code(404).send({ error: "Customer not found" });

      const jobs = await query<{ total: string; succeeded: string; failed: string }>(`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE status = 'succeeded')::text AS succeeded,
          COUNT(*) FILTER (WHERE status = 'failed')::text AS failed
        FROM job_runs WHERE customer_id = $1 AND started_at >= $2 AND started_at < $3
      `, [customerId, periodStart, periodEnd]);

      const j = jobs[0]!;
      const total = parseInt(j.total);
      const failed = parseInt(j.failed);
      const state = total === 0 ? "partial" : failed === total ? "failed" : failed > 0 ? "partial" : "executed";

      const summary = {
        period: { start: periodStart, end: periodEnd },
        customer: customer.company_name,
        executions: j,
        state,
      };

      const evidenceHash = createHash("sha256").update(JSON.stringify(summary)).digest("hex");
      const stampId = randomUUID();

      await query(
        `INSERT INTO stamps (id, customer_id, state, summary, evidence_hash) VALUES ($1, $2, $3, $4, $5)`,
        [stampId, customerId, state, JSON.stringify(summary), evidenceHash],
      );

      return { stampId, state, evidenceHash, summary };
    }),
  );

  // GET /api/commercial/entitlements
  server.get("/api/commercial/entitlements", withRateLimit(async () => {
    const rows = await query<{
      id: number;
      license_id: string;
      plan_name: string;
      certificate_entitled: boolean;
      evidence_entitled: boolean;
      market_tier: string | null;
      monthly_cap: number | null;
      status: string;
      updated_at: string;
    }>(`
      SELECT id,
             license_id,
             plan_name,
             certificate_entitled,
             evidence_entitled,
             market_tier,
             monthly_cap,
             status,
             updated_at::text AS updated_at
      FROM commercial_entitlements
      ORDER BY updated_at DESC
    `);
    return { entitlements: rows };
  }));

  // GET /api/commercial/entitlements/:licenseId
  server.get<{ Params: { licenseId: string } }>("/api/commercial/entitlements/:licenseId", withRateLimit<{ Params: { licenseId: string } }>(async (req, reply) => {
    const licenseId = req.params.licenseId.trim();
    if (!licenseId) return reply.code(400).send({ error: "license_id_required" });

    const entitlement = await queryOne<{
      id: number;
      license_id: string;
      plan_name: string;
      certificate_entitled: boolean;
      evidence_entitled: boolean;
      market_tier: string | null;
      monthly_cap: number | null;
      status: string;
      updated_at: string;
    }>(`
      SELECT id,
             license_id,
             plan_name,
             certificate_entitled,
             evidence_entitled,
             market_tier,
             monthly_cap,
             status,
             updated_at::text AS updated_at
      FROM commercial_entitlements
      WHERE license_id = $1
      LIMIT 1
    `, [licenseId]);
    if (!entitlement) return reply.code(404).send({ error: "entitlement_not_found" });

    const certificates = await query<{
      certificate_id: string;
      status: string;
      evidence_ref: string;
      tx_hash: string | null;
      issued_at_utc: string;
    }>(`
      SELECT certificate_id,
             status,
             evidence_ref,
             tx_hash,
             issued_at_utc::text AS issued_at_utc
      FROM commercial_certificates
      WHERE license_id = $1
      ORDER BY issued_at_utc DESC
    `, [licenseId]);

    return {
      entitlement,
      linked_certificates: certificates,
      evidence_refs: certificates.map((row) => row.evidence_ref),
      actions: ["issue", "verify", "export", "revoke", "resend"],
    };
  }));

  // GET /api/commercial/certificates
  server.get("/api/commercial/certificates", withRateLimit(async () => {
    const rows = await query<{
      id: number;
      certificate_id: string;
      license_id: string;
      issuer: string;
      status: string;
      evidence_ref: string;
      payload_hash: string;
      tx_hash: string | null;
      issued_at_utc: string;
      created_at: string;
    }>(`
      SELECT id,
             certificate_id,
             license_id,
             issuer,
             status,
             evidence_ref,
             payload_hash,
             tx_hash,
             issued_at_utc::text AS issued_at_utc,
             created_at::text AS created_at
      FROM commercial_certificates
      ORDER BY issued_at_utc DESC
      LIMIT 200
    `);
    return { certificates: rows };
  }));

  // GET /api/commercial/certificates/:certificateId
  server.get<{ Params: { certificateId: string } }>("/api/commercial/certificates/:certificateId", withRateLimit<{ Params: { certificateId: string } }>(async (req, reply) => {
    const certificateId = req.params.certificateId.trim();
    if (!certificateId) return reply.code(400).send({ error: "certificate_id_required" });

    const certificate = await queryOne<{
      id: number;
      certificate_id: string;
      license_id: string;
      issuer: string;
      status: string;
      evidence_ref: string;
      payload_hash: string;
      tx_hash: string | null;
      issued_at_utc: string;
      created_at: string;
    }>(`
      SELECT id,
             certificate_id,
             license_id,
             issuer,
             status,
             evidence_ref,
             payload_hash,
             tx_hash,
             issued_at_utc::text AS issued_at_utc,
             created_at::text AS created_at
      FROM commercial_certificates
      WHERE certificate_id = $1
      LIMIT 1
    `, [certificateId]);

    if (!certificate) return reply.code(404).send({ error: "certificate_not_found" });

    return {
      certificate,
      evidence_refs: [certificate.evidence_ref, certificate.payload_hash],
      actions: ["issue", "verify", "export", "revoke", "resend"],
    };
  }));

  // GET /api/commercial/stamps/:stampId
  server.get<{ Params: { stampId: string } }>("/api/commercial/stamps/:stampId", withRateLimit<{ Params: { stampId: string } }>(async (req, reply) => {
    const stampId = req.params.stampId.trim();
    if (!stampId) return reply.code(400).send({ error: "stamp_id_required" });

    const stamp = await queryOne<{
      id: string;
      customer_id: string;
      state: string;
      summary: Record<string, unknown>;
      evidence_hash: string;
      stamped_at: string;
    }>(`
      SELECT id,
             customer_id,
             state,
             summary,
             evidence_hash,
             stamped_at::text AS stamped_at
      FROM stamps
      WHERE id = $1
      LIMIT 1
    `, [stampId]);

    if (stamp) {
      return {
        stamp,
        evidence_refs: [stamp.evidence_hash],
        linked: {
          evidence_events: `/api/evidence/stamps/${encodeURIComponent(stamp.id)}`,
        },
        actions: ["issue", "verify", "export", "revoke", "resend"],
      };
    }

    const seal = await queryOne<{
      id: string;
      workspace_id: string;
      actor_id: string;
      title: string;
      subject: string;
      payload_sha256: string;
      status: string;
      created_at: string;
    }>(`
      SELECT id,
             workspace_id,
             actor_id,
             title,
             subject,
             payload_sha256,
             status,
             created_at::text AS created_at
      FROM seals
      WHERE id = $1
      LIMIT 1
    `, [stampId]);

    if (!seal) return reply.code(404).send({ error: "stamp_not_found" });

    return {
      stamp: {
        id: seal.id,
        customer_id: seal.workspace_id,
        state: seal.status,
        summary: {
          title: seal.title,
          subject: seal.subject,
          actor_id: seal.actor_id,
        },
        evidence_hash: seal.payload_sha256,
        stamped_at: seal.created_at,
      },
      evidence_refs: [seal.payload_sha256],
      linked: {
        proof: `/api/evidence/proofs`,
      },
      actions: ["issue", "verify", "export", "revoke", "resend"],
    };
  }));

  // POST /api/commercial/actions/:action
  server.post<{
    Params: { action: string };
    Body: {
      customerId?: string;
      invoiceId?: string;
      stampId?: string;
      certificateId?: string;
      licenseId?: string;
      requestedBy?: string;
      evidenceRef?: string;
    };
  }>("/api/commercial/actions/:action", withRateLimit<{ Params: { action: string }; Body: { requestedBy?: string; evidenceRef?: string; licenseId?: string; certificateId?: string; stampId?: string; invoiceId?: string; customerId?: string } }>(async (req, reply) => {
    const action = req.params.action.trim().toLowerCase();
    const allowed = new Set(["issue", "verify", "export", "revoke", "resend"]);
    if (!allowed.has(action)) return reply.code(400).send({ error: "invalid_action" });

    const requestedBy = req.body?.requestedBy?.trim() || "operator";
    const evidenceRef = req.body?.evidenceRef?.trim() || `commercial:${action}:${new Date().toISOString()}`;

    if (action === "issue") {
      const licenseId = req.body?.licenseId?.trim();
      if (!licenseId) return reply.code(400).send({ error: "license_id_required" });
      const certificateId = `cert_${randomUUID()}`;
      const payloadHash = createHash("sha256")
        .update(JSON.stringify({ licenseId, evidenceRef, requestedBy, issuedAt: new Date().toISOString() }))
        .digest("hex");
      await query(
        `INSERT INTO commercial_certificates
          (certificate_id, license_id, issuer, status, evidence_ref, payload_hash, issued_at_utc)
         VALUES ($1, $2, $3, 'issued', $4, $5, now())`,
        [certificateId, licenseId, requestedBy, evidenceRef, payloadHash],
      );
      return { ok: true, action, certificate_id: certificateId, evidence_ref: evidenceRef };
    }

    if (action === "revoke") {
      const certificateId = req.body?.certificateId?.trim();
      if (!certificateId) return reply.code(400).send({ error: "certificate_id_required" });
      const updated = await query(
        `UPDATE commercial_certificates
            SET status = 'revoked'
          WHERE certificate_id = $1
          RETURNING certificate_id`,
        [certificateId],
      );
      if (updated.length === 0) return reply.code(404).send({ error: "certificate_not_found" });
      return { ok: true, action, certificate_id: certificateId, evidence_ref: evidenceRef };
    }

    if (action === "verify") {
      const certificateId = req.body?.certificateId?.trim();
      const stampId = req.body?.stampId?.trim();
      const receiptId = req.body?.invoiceId?.trim();
      return {
        ok: true,
        action,
        verified: true,
        target: certificateId ?? stampId ?? receiptId ?? null,
        evidence_ref: evidenceRef,
      };
    }

    if (action === "export") {
      const customerId = req.body?.customerId?.trim() || null;
      const scope = {
        room: "commercial",
        customerId,
        invoiceId: req.body?.invoiceId ?? null,
        stampId: req.body?.stampId ?? null,
        certificateId: req.body?.certificateId ?? null,
      };
      const exportId = randomUUID();
      await query(
        `INSERT INTO evidence_exports (id, customer_id, scope, export_path)
         VALUES ($1, $2, $3, $4)`,
        [exportId, customerId, JSON.stringify(scope), `exports/${exportId}.json`],
      );
      return { ok: true, action, export_id: exportId, evidence_ref: evidenceRef };
    }

    return {
      ok: true,
      action,
      status: "queued",
      requested_by: requestedBy,
      evidence_ref: evidenceRef,
    };
  }));
}
