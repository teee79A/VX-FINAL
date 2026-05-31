/**
 * VYRDx Seal Service — Production seal flow (DB-backed)
 *
 * POST /api/v1/seals            — Create seal (hash-chained, usage-enforced, transactional)
 * GET  /api/v1/proofs/:proofId  — Public proof data (JSON)
 * POST /api/v1/proofs/verify    — Verify proof by ID or hash
 * GET  /proof/:proofId          — Public proof page (HTML)
 * GET  /p/:proofId              — Short URL redirect
 * GET  /api/v1/workspaces/:workspaceId/usage  — Usage stats
 * GET  /api/v1/workspaces/:workspaceId/seals  — List seals with filters
 *
 * Core product: Create seal → get proof link → share
 * VYRDON Law §1: No fabricated data
 */

import { createHash, randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import type { FastifyInstance } from "fastify";
import PDFDocument from "pdfkit";
import { query, queryOne, getPool } from "../db.js";
import { withRateLimit } from "../lib/rate-limit.js";
import { getPlanLimit } from "../lib/entitlements.js";
import { runtimeModeService } from "../services/runtimeModeService.js";
import { appendEvidenceLedgerTx } from "../lib/evidence-ledger.js";

// ── CONSTANTS ───────────────────────────────────────────────────────────────

const PROOF_BASE_URL = process.env.PROOF_BASE_URL ?? "https://vyrdx.vyrdon.com";

// ── HELPERS ─────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  return Object.keys(obj as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortKeys((obj as Record<string, unknown>)[key]);
      return acc;
    }, {});
}

function canonicalJson(obj: Record<string, unknown>): string {
  return JSON.stringify(sortKeys(obj));
}

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function notFoundHtml(): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>VYRDON — Not Found</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#030308;color:#f0f0f0;font-family:'Inter',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;text-align:center;padding:2rem}</style>
</head><body>
<div>
  <p style="font-family:'Bebas Neue',sans-serif;font-size:2rem;letter-spacing:.15em;margin-bottom:12px">VYRD<span style="color:#00ff88">O</span>N</p>
  <p style="font-size:15px;color:rgba(255,255,255,.4);margin-bottom:24px">This certificate was not found or is not public.</p>
  <a href="/" style="color:#00ff88;font-size:13px;text-decoration:none;border:1px solid #00ff8830;padding:10px 24px;border-radius:8px;display:inline-block">Return to VYRDON</a>
</div>
</body></html>`;
}

function buildProofHtml(
  row: {
    seal_id: string;
    title: string; subject: string; description: string;
    payload_sha256: string; previous_hash: string; sequence_no: string;
    seal_created_at: string; display_name: string;
  },
  verified: boolean,
  proofId: string,
  publicMeta: Record<string, string>,
): string {
  const vc = verified ? "#00ff88" : "#ff2244";
  const ts = escapeHtml(new Date(String(row.seal_created_at)).toLocaleString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  }));
  const shortProof = escapeHtml(proofId.length > 20 ? proofId.slice(0, 20) + "…" : proofId);

  const metaHtml = Object.entries(publicMeta)
    .filter(([k]) => k !== "actorName")
    .map(([k, v]) => `<div class="sum-row"><span class="sum-label">${escapeHtml(metaLabel(k))}</span><span class="sum-value">${escapeHtml(v)}</span></div>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>VYRDON CERTIFIED — ${escapeHtml(row.title)}</title>
<meta property="og:title" content="VYRDON CERTIFIED — ${escapeHtml(row.title)}" />
<meta property="og:description" content="Certified execution proof for ${escapeHtml(row.subject)}. Verified by VYRDON protocol." />
<meta property="og:type" content="article" />
<meta property="og:url" content="${PROOF_BASE_URL}/proof/${escapeHtml(proofId)}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="VYRDON CERTIFIED — ${escapeHtml(row.title)}" />
<meta name="twitter:description" content="Certified execution proof. Hash-verified, tamper-evident." />
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#030308;color:#f0f0f0;font-family:'Inter',sans-serif;min-height:100vh;padding:40px 20px}
.shell{max-width:920px;margin:0 auto}

/* Header */
.hdr{margin-bottom:32px}
.cert-badge{display:inline-block;font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:.25em;color:${vc};border:1px solid ${vc}40;padding:6px 16px;border-radius:6px;margin-bottom:16px}
.hdr h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(28px,5vw,48px);letter-spacing:.04em;line-height:1.1;margin-bottom:10px}
.hdr .sub{font-size:15px;color:rgba(255,255,255,.4);line-height:1.5;max-width:680px}

/* Verification badge card */
.ver-card{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:20px 24px;border-radius:16px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.015);margin-bottom:24px;min-height:72px}
.ver-left{display:flex;align-items:center;gap:12px}
.ver-dot{width:12px;height:12px;border-radius:50%;background:${vc};box-shadow:0 0 16px ${vc}}
.ver-text{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:.1em;color:${vc}}
.ver-right{text-align:right}
.ver-ts{font-size:12px;color:rgba(255,255,255,.35)}
.ver-id{font-family:'Space Mono',monospace;font-size:11px;color:rgba(255,255,255,.2);margin-top:2px}

/* Summary card */
.card{padding:24px 28px;border-radius:16px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.015);margin-bottom:20px}
.card-title{font-size:11px;color:rgba(255,255,255,.3);letter-spacing:.15em;text-transform:uppercase;margin-bottom:18px}
.sum-grid{display:grid;grid-template-columns:1fr 1fr;gap:0}
.sum-row{padding:12px 0;border-bottom:1px solid rgba(255,255,255,.03)}
.sum-label{display:block;font-size:11px;color:rgba(255,255,255,.3);letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}
.sum-value{display:block;font-size:16px;color:#d0d0d0;line-height:1.45}
.sum-row.full{grid-column:1/-1}

/* Hash card */
.hash-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.03)}
.hash-row:last-child{border-bottom:none}
.hash-label{font-size:11px;color:rgba(255,255,255,.3);letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}
.hash-val{font-family:'Space Mono',monospace;font-size:13px;color:#00ff88;word-break:break-all;line-height:1.5}
.copy-btn{flex-shrink:0;background:none;border:1px solid rgba(255,255,255,.06);color:rgba(255,255,255,.3);font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;font-family:'Inter',sans-serif;transition:border-color .2s}
.copy-btn:hover{border-color:#00ff88;color:#00ff88}

/* Footer */
.proof-footer{margin-top:40px;padding-top:28px;border-top:1px solid rgba(255,255,255,.04)}
.footer-title{font-size:13px;font-weight:600;color:rgba(255,255,255,.5);margin-bottom:6px}
.footer-desc{font-size:13px;color:rgba(255,255,255,.25);line-height:1.5;margin-bottom:16px}
.footer-links{display:flex;gap:20px;flex-wrap:wrap}
.footer-links a{font-size:12px;color:#00ff88;text-decoration:none;transition:opacity .2s}
.footer-links a:hover{opacity:.7}
.trust-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;margin-top:12px}
.trust-item{font-size:13px;color:rgba(255,255,255,.6);display:flex;align-items:center;gap:8px}
.trust-check{color:${vc};font-size:14px;font-weight:700}
.dl-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:10px;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:border-color .2s,opacity .2s;background:transparent;color:#00ff88;border:1px solid #00ff8830;text-decoration:none}
.dl-btn:hover{border-color:#00ff88;opacity:.85}

@media(max-width:640px){
  .sum-grid{grid-template-columns:1fr}
  .ver-card{flex-direction:column;align-items:flex-start}
  .ver-right{text-align:left}
}
</style>
</head>
<body>
<div class="shell">

  <!-- Header -->
  <div class="hdr">
    <div class="cert-badge">${verified ? "VYRDON CERTIFIED" : "VERIFICATION FAILED"}</div>
    <h1>${escapeHtml(row.title)}</h1>
    <p class="sub">This action has been cryptographically certified and published as a verifiable proof record.</p>
  </div>

  <!-- Verification status -->
  <div class="ver-card">
    <div class="ver-left">
      <div class="ver-dot"></div>
      <div class="ver-text">${verified ? "Verified" : "Failed"}</div>
    </div>
    <div class="ver-right">
      <div class="ver-ts">${ts}</div>
      <div class="ver-id">${shortProof}</div>
    </div>
  </div>

  <!-- Certificate summary -->
  <div class="card">
    <div class="card-title">Certificate summary</div>
    <div class="sum-grid">
      <div class="sum-row"><span class="sum-label">Subject</span><span class="sum-value">${escapeHtml(row.subject)}</span></div>
      <div class="sum-row"><span class="sum-label">Performed by</span><span class="sum-value">${escapeHtml(publicMeta.actorName ?? row.display_name)}</span></div>
      ${row.description ? `<div class="sum-row full"><span class="sum-label">Description</span><span class="sum-value">${escapeHtml(row.description)}</span></div>` : ""}
      <div class="sum-row"><span class="sum-label">Issued at</span><span class="sum-value">${ts}</span></div>
      <div class="sum-row"><span class="sum-label">Sequence</span><span class="sum-value">#${escapeHtml(row.sequence_no)}</span></div>
    </div>
  </div>

  <!-- Record integrity -->
  <div class="card">
    <div class="card-title">Record integrity</div>
    <div class="hash-row">
      <div><div class="hash-label">SHA-256 Hash</div><div class="hash-val">${escapeHtml(row.payload_sha256)}</div></div>
      <button class="copy-btn" onclick="navigator.clipboard.writeText('${escapeHtml(row.payload_sha256)}')">Copy</button>
    </div>
    ${row.previous_hash ? `<div class="hash-row">
      <div><div class="hash-label">Previous hash</div><div class="hash-val">${escapeHtml(row.previous_hash)}</div></div>
      <button class="copy-btn" onclick="navigator.clipboard.writeText('${escapeHtml(row.previous_hash)}')">Copy</button>
    </div>` : ""}
    <div class="hash-row">
      <div><div class="hash-label">Sequence number</div><div class="hash-val" style="color:#d0d0d0">#${escapeHtml(row.sequence_no)}</div></div>
    </div>
  </div>

  ${metaHtml ? `<!-- Public metadata -->
  <div class="card">
    <div class="card-title">Details</div>
    <div class="sum-grid">${metaHtml}</div>
  </div>` : ""}

  <!-- Footer -->
  <div class="proof-footer">
    <div class="footer-title">This record is</div>
    <div class="trust-grid">
      <div class="trust-item"><span class="trust-check">✓</span> Cryptographically sealed</div>
      <div class="trust-item"><span class="trust-check">✓</span> Time-stamped</div>
      <div class="trust-item"><span class="trust-check">✓</span> Tamper-resistant</div>
      <div class="trust-item"><span class="trust-check">✓</span> Publicly verifiable</div>
    </div>
    <div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap">
      <a href="${PROOF_BASE_URL}/api/v1/seals/${escapeHtml(row.seal_id)}/certificate" class="dl-btn">⬇ Download Certificate (PDF)</a>
      <button class="dl-btn" onclick="navigator.clipboard.writeText(window.location.href).then(()=>this.textContent='Copied!')">🔗 Copy Proof Link</button>
    </div>
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,.04)">
      <div class="footer-desc">VYRDON issues certified execution records that cannot be disputed. Certify work. Eliminate disputes.</div>
      <div class="footer-links">
        <a href="https://vyrdon.com">About VYRDON</a>
        <a href="${PROOF_BASE_URL}/pricing">Pricing</a>
        <a href="${PROOF_BASE_URL}/certify">Certify your own action</a>
        <a href="mailto:contact@vyrdon.com">Contact</a>
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
}

function metaLabel(key: string): string {
  switch (key) {
    case "clientName": return "Client";
    case "projectId": return "Project";
    case "category": return "Category";
    default: return key;
  }
}

// ── ROUTES ──────────────────────────────────────────────────────────────────

export async function registerSealService(server: FastifyInstance): Promise<void> {

  // ── POST /api/v1/seals ──────────────────────────────────────────────────

  server.post<{
    Body: {
      workspaceId: string;
      actorId: string;
      title: string;
      subject: string;
      description?: string;
      metadata?: Record<string, unknown>;
      idempotencyKey?: string;
    };
  }>("/api/v1/seals", withRateLimit<{ Body: { workspaceId?: string; actorId?: string; title?: string; subject?: string; description?: string; metadata?: Record<string, unknown>; idempotencyKey?: string } }>(async (request, reply) => {
    try {
      runtimeModeService.requirePrimaryDbMode("certificate_issue");
    } catch (error) {
      if (error instanceof runtimeModeService.RuntimeModeError) {
        return reply.status(503).send({
          error: error.code,
          reason: error.reason,
          scope: error.scope,
          runtimeMode: error.runtimeMode,
          message: "Certificate issuance is blocked while runtime is degraded.",
        });
      }
      throw error;
    }

    const body = request.body ?? ({} as Record<string, unknown>);
    const originRoomHeader = request.headers["x-vyrdx-origin-room"];
    const originRoom = (Array.isArray(originRoomHeader) ? originRoomHeader[0] : originRoomHeader)?.toLowerCase();
    const workspaceId = (body.workspaceId as string | undefined)?.trim();
    const actorId = (body.actorId as string | undefined)?.trim();
    const title = (body.title as string | undefined)?.trim();
    const subject = (body.subject as string | undefined)?.trim();
    const description = ((body.description as string | undefined)?.trim()) ?? "";
    const metadata = (body.metadata ?? {}) as Record<string, unknown>;
    const idempotencyKey = (body.idempotencyKey as string | undefined)?.trim();

    if (originRoom !== "commercial") {
      return reply.status(403).send({
        error: "certificate_origin_forbidden",
        message: "Commercial is the only allowed certificate origin room.",
      });
    }

    if (!workspaceId || !actorId || !title || !subject) {
      return reply.status(400).send({
        error: "missing_fields",
        message: "workspaceId, actorId, title, and subject are required",
      });
    }

    const evidenceRefValue = metadata["evidenceRef"] ?? metadata["evidence_ref"];
    if (typeof evidenceRefValue !== "string" || evidenceRefValue.trim().length === 0) {
      return reply.status(422).send({
        error: "evidence_ref_required",
        message: "Certificate issuance requires evidenceRef in metadata.",
      });
    }
    const evidenceRef = evidenceRefValue.trim();
    metadata["evidenceRef"] = evidenceRef;

    // Idempotency check
    if (idempotencyKey) {
      const existing = await queryOne<{ seal_id: string }>(
        "SELECT seal_id FROM seal_metadata WHERE key = 'idempotency_key' AND value_text = $1",
        [idempotencyKey],
      );
      if (existing) {
        const proof = await queryOne<{ id: string; proof_url: string }>(
          "SELECT id, proof_url FROM proofs WHERE seal_id = $1",
          [existing.seal_id],
        );
        const seal = await queryOne<{ payload_sha256: string; previous_hash: string; sequence_no: string; created_at: string }>(
          "SELECT payload_sha256, previous_hash, sequence_no, created_at FROM seals WHERE id = $1",
          [existing.seal_id],
        );
        if (proof && seal) {
          return reply.status(200).send({
            sealId: existing.seal_id,
            proofId: proof.id,
            proofUrl: proof.proof_url,
            hash: seal.payload_sha256,
            previousHash: seal.previous_hash,
            sequence: parseInt(seal.sequence_no, 10),
            createdAt: seal.created_at,
            deduplicated: true,
          });
        }
      }
    }

    // Load workspace
    const workspace = await queryOne<{ id: string; plan: string; name: string }>(
      "SELECT id, plan, name FROM workspaces WHERE id = $1",
      [workspaceId],
    );
    if (!workspace) {
      return reply.status(404).send({ error: "workspace_not_found" });
    }

    // Load actor
    const actor = await queryOne<{ id: string; display_name: string }>(
      "SELECT id, display_name FROM users WHERE id = $1 AND workspace_id = $2",
      [actorId, workspaceId],
    );
    if (!actor) {
      return reply.status(404).send({ error: "actor_not_found" });
    }

    // Check usage
    const planLimit = getPlanLimit(workspace.plan);
    const usagePeriod = await queryOne<{ id: string; used_seals: number; included_seals: number }>(
      `SELECT id, used_seals, included_seals FROM workspace_usage_periods
       WHERE workspace_id = $1 AND period_start <= now() AND period_end > now()
       ORDER BY period_start DESC LIMIT 1`,
      [workspaceId],
    );
    const usedSeals = usagePeriod?.used_seals ?? 0;
    const includedSeals = usagePeriod?.included_seals ?? planLimit;

    if (usedSeals >= includedSeals) {
      return reply.status(402).send({
        error: "plan_limit_reached",
        message: "You have used all included certificates for this billing period.",
        plan: workspace.plan,
        included: includedSeals,
        used: usedSeals,
        upgradeUrl: `${PROOF_BASE_URL}/pricing`,
      });
    }

    // Transaction: lock workspace row, create seal + proof + metadata + event, update usage
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Lock workspace to prevent concurrent sequence collision
      await client.query("SELECT id FROM workspaces WHERE id = $1 FOR UPDATE", [workspaceId]);

      // Get last seal for chaining
      const lastSealResult = await client.query<{ id: string; payload_sha256: string; sequence_no: string }>(
        "SELECT id, payload_sha256, sequence_no FROM seals WHERE workspace_id = $1 ORDER BY sequence_no DESC LIMIT 1",
        [workspaceId],
      );
      const lastSeal = lastSealResult.rows[0] ?? null;
      const previousSealId = lastSeal?.id ?? null;
      const previousHash = lastSeal?.payload_sha256 ?? null;
      const sequenceNo = lastSeal ? parseInt(lastSeal.sequence_no, 10) + 1 : 1;

      // Build canonical payload
      const timestamp = new Date().toISOString();
      const canonicalPayload: Record<string, unknown> = {
        workspaceId,
        actorId,
        title,
        subject,
        description,
        metadata,
        timestamp,
        previousHash,
        sequence: sequenceNo,
      };
      const payloadSha256 = sha256(canonicalJson(canonicalPayload));

      // Generate IDs
      const sealId = generateId("seal");
      const proofId = generateId("proof");
      const proofUrl = `${PROOF_BASE_URL}/proof/${proofId}`;

      // Insert seal
      await client.query(
        `INSERT INTO seals (id, workspace_id, actor_id, title, subject, description, payload_json, payload_sha256, previous_seal_id, previous_hash, sequence_no)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [sealId, workspaceId, actorId, title, subject, description, JSON.stringify(canonicalPayload), payloadSha256, previousSealId, previousHash, sequenceNo],
      );

      // Insert proof
      await client.query(
        `INSERT INTO proofs (id, seal_id, workspace_id, public_slug, proof_url)
         VALUES ($1, $2, $3, $4, $5)`,
        [proofId, sealId, workspaceId, proofId, proofUrl],
      );

      // Seal event
      const eventId = generateId("evt");
      await client.query(
        `INSERT INTO seal_events (id, seal_id, workspace_id, event_type, event_data)
         VALUES ($1, $2, $3, 'seal_created', $4)`,
        [eventId, sealId, workspaceId, JSON.stringify({ actorId, title, subject })],
      );

      // Metadata
      for (const [key, value] of Object.entries(metadata)) {
        await client.query(
          "INSERT INTO seal_metadata (seal_id, key, value_text, value_json) VALUES ($1, $2, $3, $4)",
          [sealId, key, typeof value === "string" ? value : null, typeof value !== "string" ? JSON.stringify(value) : null],
        );
      }
      if (idempotencyKey) {
        await client.query(
          "INSERT INTO seal_metadata (seal_id, key, value_text) VALUES ($1, 'idempotency_key', $2)",
          [sealId, idempotencyKey],
        );
      }

      // Usage increment or create period
      if (usagePeriod) {
        await client.query(
          "UPDATE workspace_usage_periods SET used_seals = used_seals + 1, updated_at = now() WHERE id = $1",
          [usagePeriod.id],
        );
      } else {
        const periodId = generateId("usp");
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        await client.query(
          `INSERT INTO workspace_usage_periods (id, workspace_id, period_start, period_end, included_seals, used_seals)
           VALUES ($1, $2, $3, $4, $5, 1)`,
          [periodId, workspaceId, periodStart.toISOString(), periodEnd.toISOString(), planLimit],
        );
      }

      const evidence = await appendEvidenceLedgerTx(client, {
        evidenceRef,
        eventType: "certificate_issued",
        actor: actorId,
        payload: {
          workspaceId,
          sealId,
          proofId,
          sequenceNo,
          hash: payloadSha256,
          title,
          subject,
        },
      });

      await client.query("COMMIT");

      const newUsed = usedSeals + 1;
      return reply.status(201).send({
        sealId,
        proofId,
        proofUrl,
        hash: payloadSha256,
        previousHash,
        sequence: sequenceNo,
        createdAt: timestamp,
        usage: {
          plan: workspace.plan,
          included: includedSeals,
          used: newUsed,
          remaining: includedSeals - newUsed,
        },
        evidenceRef: evidence.evidenceRef,
        evidenceChainHash: evidence.chainHash,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }));

  // ── POST /api/v1/seals/:sealId/revoke ──────────────────────────────────

  server.post<{
    Params: { sealId: string };
    Body: { workspaceId?: string; actorId?: string; reason?: string; evidenceRef?: string };
  }>("/api/v1/seals/:sealId/revoke", withRateLimit<{ Params: { sealId: string }; Body: { workspaceId?: string; actorId?: string; reason?: string; evidenceRef?: string } }>(async (request, reply) => {
    try {
      runtimeModeService.requirePrimaryDbMode("certificate_revoke");
    } catch (error) {
      if (error instanceof runtimeModeService.RuntimeModeError) {
        return reply.status(503).send({
          error: error.code,
          reason: error.reason,
          scope: error.scope,
          runtimeMode: error.runtimeMode,
          message: "Certificate revoke is blocked while runtime is degraded.",
        });
      }
      throw error;
    }

    const { sealId } = request.params;
    const body = request.body ?? {};
    const originRoomHeader = request.headers["x-vyrdx-origin-room"];
    const originRoom = (Array.isArray(originRoomHeader) ? originRoomHeader[0] : originRoomHeader)?.toLowerCase();

    if (originRoom !== "commercial") {
      return reply.status(403).send({
        error: "certificate_origin_forbidden",
        message: "Commercial is the only allowed certificate origin room.",
      });
    }

    const workspaceId = body.workspaceId?.trim();
    const actorId = body.actorId?.trim();
    const reason = body.reason?.trim();
    const evidenceRef = body.evidenceRef?.trim();

    if (!workspaceId || !actorId || !reason || !evidenceRef) {
      return reply.status(400).send({
        error: "missing_fields",
        message: "workspaceId, actorId, reason, and evidenceRef are required.",
      });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const seal = await client.query<{
        id: string;
        workspace_id: string;
        status: string;
        payload_sha256: string;
      }>(
        "SELECT id, workspace_id, status, payload_sha256 FROM seals WHERE id = $1 FOR UPDATE",
        [sealId],
      );
      const row = seal.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return reply.status(404).send({ error: "seal_not_found" });
      }

      if (row.workspace_id !== workspaceId) {
        await client.query("ROLLBACK");
        return reply.status(403).send({ error: "workspace_mismatch" });
      }

      if (row.status === "revoked") {
        await client.query("ROLLBACK");
        return reply.status(200).send({
          sealId,
          status: "revoked",
          reason: "already_revoked",
        });
      }

      await client.query("UPDATE seals SET status = 'revoked' WHERE id = $1", [sealId]);
      await client.query("UPDATE proofs SET is_public = false WHERE seal_id = $1", [sealId]);

      const eventId = generateId("evt");
      await client.query(
        `INSERT INTO seal_events (id, seal_id, workspace_id, event_type, event_data)
         VALUES ($1, $2, $3, 'seal_revoked', $4)`,
        [eventId, sealId, workspaceId, JSON.stringify({ actorId, reason })],
      );

      await client.query(
        "INSERT INTO seal_metadata (seal_id, key, value_text) VALUES ($1, 'revocation_reason', $2)",
        [sealId, reason],
      );

      const evidence = await appendEvidenceLedgerTx(client, {
        evidenceRef,
        eventType: "certificate_revoked",
        actor: actorId,
        payload: {
          workspaceId,
          sealId,
          reason,
          hash: row.payload_sha256,
        },
      });

      await client.query("COMMIT");

      return reply.status(200).send({
        sealId,
        status: "revoked",
        reason,
        evidenceRef: evidence.evidenceRef,
        evidenceChainHash: evidence.chainHash,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }));

  // ── GET /api/v1/proofs/:proofId ─────────────────────────────────────────

  server.get<{ Params: { proofId: string } }>("/api/v1/proofs/:proofId", withRateLimit<{ Params: { proofId: string } }>(async (request, reply) => {
    const { proofId } = request.params;

    const row = await queryOne<{
      proof_id: string; seal_id: string; workspace_name: string;
      title: string; subject: string; description: string;
      payload_sha256: string; previous_hash: string; sequence_no: string;
      seal_created_at: string; display_name: string; payload_json: string;
      is_public: boolean;
    }>(
      `SELECT p.id AS proof_id, s.id AS seal_id, w.name AS workspace_name,
              s.title, s.subject, s.description, s.payload_sha256, s.previous_hash,
              s.sequence_no, s.created_at AS seal_created_at, u.display_name,
              s.payload_json::text AS payload_json, p.is_public
       FROM proofs p
       JOIN seals s ON p.seal_id = s.id
       JOIN workspaces w ON p.workspace_id = w.id
       JOIN users u ON s.actor_id = u.id
       WHERE p.id = $1 OR p.public_slug = $1`,
      [proofId],
    );

    if (!row || !row.is_public) {
      return reply.status(404).send({ error: "Proof not found" });
    }

    const payloadJson = JSON.parse(row.payload_json) as Record<string, unknown>;
    const recomputedHash = sha256(canonicalJson(payloadJson));
    const hashValid = recomputedHash === row.payload_sha256;

    let chainValid = true;
    if (row.previous_hash) {
      const prevSeal = await queryOne<{ id: string }>(
        "SELECT id FROM seals WHERE payload_sha256 = $1",
        [row.previous_hash],
      );
      chainValid = prevSeal !== null;
    }

    const metaRows = await query<{ key: string; value_text: string | null; value_json: string | null }>(
      "SELECT key, value_text, value_json FROM seal_metadata WHERE seal_id = $1 AND key != 'idempotency_key'",
      [row.seal_id],
    );
    const metadata: Record<string, unknown> = {};
    for (const m of metaRows) {
      metadata[m.key] = m.value_json ? JSON.parse(m.value_json) : m.value_text;
    }

    return {
      proofId: row.proof_id,
      sealId: row.seal_id,
      workspaceName: row.workspace_name,
      title: row.title,
      subject: row.subject,
      description: row.description,
      hash: row.payload_sha256,
      previousHash: row.previous_hash,
      sequence: parseInt(row.sequence_no, 10),
      createdAt: row.seal_created_at,
      actor: { displayName: row.display_name },
      verification: {
        status: hashValid && chainValid ? "valid" as const : "invalid" as const,
        verifiedAt: new Date().toISOString(),
      },
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }));

  // ── POST /api/v1/proofs/verify ──────────────────────────────────────────

  server.post<{ Body: { proofId?: string; hash?: string } }>("/api/v1/proofs/verify", withRateLimit<{ Body: { proofId?: string; hash?: string } }>(async (request, reply) => {
    const { proofId, hash } = request.body ?? {};

    if (!proofId && !hash) {
      return reply.status(400).send({ error: "Provide proofId or hash" });
    }

    let sealData: {
      id: string;
      payload_json: string;
      payload_sha256: string;
      previous_hash: string;
      created_at: string;
      status: string;
    } | null = null;
    let foundProofId: string | null = null;
    let proofIsPublic = false;

    if (proofId) {
      const joined = await queryOne<{
        proof_id: string;
        seal_id: string;
        payload_json: string;
        payload_sha256: string;
        previous_hash: string;
        seal_created_at: string;
        seal_status: string;
        is_public: boolean;
      }>(
        `SELECT p.id AS proof_id, s.id AS seal_id, s.payload_json::text AS payload_json,
                s.payload_sha256, s.previous_hash, s.created_at AS seal_created_at,
                s.status AS seal_status, p.is_public
         FROM proofs p JOIN seals s ON p.seal_id = s.id
         WHERE p.id = $1`,
        [proofId],
      );
      if (joined) {
        foundProofId = joined.proof_id;
        proofIsPublic = joined.is_public;
        sealData = {
          id: joined.seal_id,
          payload_json: joined.payload_json,
          payload_sha256: joined.payload_sha256,
          previous_hash: joined.previous_hash,
          created_at: joined.seal_created_at,
          status: joined.seal_status,
        };
      }
    } else if (hash) {
      sealData = await queryOne<{ id: string; payload_json: string; payload_sha256: string; previous_hash: string; created_at: string; status: string }>(
        "SELECT id, payload_json::text AS payload_json, payload_sha256, previous_hash, created_at, status FROM seals WHERE payload_sha256 = $1",
        [hash],
      );
      if (sealData) {
        const proofRow = await queryOne<{ id: string; is_public: boolean }>(
          "SELECT id, is_public FROM proofs WHERE seal_id = $1",
          [sealData.id],
        );
        foundProofId = proofRow?.id ?? null;
        proofIsPublic = proofRow?.is_public ?? false;
      }
    }

    if (!sealData) {
      return reply.status(404).send({ valid: false, error: "Not found" });
    }

    if (sealData.status === "revoked") {
      return {
        valid: false,
        status: "revoked" as const,
        proofId: foundProofId,
        sealId: sealData.id,
        hash: sealData.payload_sha256,
        createdAt: sealData.created_at,
        reason: "certificate_revoked",
      };
    }

    if (!proofIsPublic) {
      return {
        valid: false,
        status: "not_public" as const,
        proofId: foundProofId,
        sealId: sealData.id,
        hash: sealData.payload_sha256,
        createdAt: sealData.created_at,
      };
    }

    const payloadJson = JSON.parse(sealData.payload_json) as Record<string, unknown>;
    const recomputed = sha256(canonicalJson(payloadJson));
    const hashValid = recomputed === sealData.payload_sha256;

    let chainValid = true;
    if (sealData.previous_hash) {
      const prev = await queryOne<{ id: string }>(
        "SELECT id FROM seals WHERE payload_sha256 = $1",
        [sealData.previous_hash],
      );
      chainValid = prev !== null;
    }

    return {
      valid: hashValid && chainValid,
      status: hashValid && chainValid ? "valid" as const : "invalid" as const,
      proofId: foundProofId,
      sealId: sealData.id,
      hash: sealData.payload_sha256,
      createdAt: sealData.created_at,
      chainValid,
    };
  }));

  // ── GET /proof/:proofId — HTML proof page ───────────────────────────────

  server.get<{ Params: { proofId: string } }>("/proof/:proofId", withRateLimit<{ Params: { proofId: string } }>(async (request, reply) => {
    const { proofId } = request.params;

    const row = await queryOne<{
      seal_id: string;
      title: string; subject: string; description: string;
      payload_sha256: string; previous_hash: string; sequence_no: string;
      seal_created_at: string; display_name: string; payload_json: string;
      is_public: boolean;
    }>(
      `SELECT s.id AS seal_id, s.title, s.subject, s.description, s.payload_sha256, s.previous_hash,
              s.sequence_no, s.created_at AS seal_created_at, u.display_name,
              s.payload_json::text AS payload_json, p.is_public
       FROM proofs p
       JOIN seals s ON p.seal_id = s.id
       JOIN users u ON s.actor_id = u.id
       WHERE p.id = $1 OR p.public_slug = $1`,
      [proofId],
    );

    if (!row || !row.is_public) {
      return reply.status(404).type("text/html").send(notFoundHtml());
    }

    const payloadJson = JSON.parse(row.payload_json) as Record<string, unknown>;
    const recomputed = sha256(canonicalJson(payloadJson));
    const verified = recomputed === row.payload_sha256;

    // Load public-safe metadata
    const metaRows = await query<{ key: string; value_text: string | null; value_json: string | null }>(
      "SELECT key, value_text, value_json FROM seal_metadata WHERE seal_id = $1 AND key NOT IN ('idempotency_key')",
      [row.seal_id],
    );
    const publicMeta: Record<string, string> = {};
    const allowedKeys = new Set(["clientName", "category", "projectId", "actorName"]);
    for (const m of metaRows) {
      if (allowedKeys.has(m.key)) {
        publicMeta[m.key] = m.value_text ?? (m.value_json ? String(m.value_json) : "");
      }
    }

    const html = buildProofHtml(row, verified, proofId, publicMeta);
    return reply.type("text/html").send(html);
  }));

  // ── GET /p/:proofId — short URL redirect ────────────────────────────────

  server.get<{ Params: { proofId: string } }>("/p/:proofId", withRateLimit<{ Params: { proofId: string } }>(async (_request, reply) => {
    return reply.redirect(`/proof/${_request.params.proofId}`);
  }));

  // ── GET /api/v1/usage — simplified usage endpoint ──────────────────────

  server.get<{ Querystring: { workspaceId?: string } }>("/api/v1/usage", withRateLimit<{ Querystring: { workspaceId?: string } }>(async (request, reply) => {
    const workspaceId = request.query.workspaceId?.trim();
    if (!workspaceId) {
      return reply.status(400).send({ error: "workspaceId_required" });
    }

    const workspace = await queryOne<{ id: string; plan: string }>(
      "SELECT id, plan FROM workspaces WHERE id = $1",
      [workspaceId],
    );
    if (!workspace) return reply.status(404).send({ error: "Workspace not found" });

    const planLimit = getPlanLimit(workspace.plan);
    const period = await queryOne<{ used_seals: number; included_seals: number }>(
      `SELECT used_seals, included_seals FROM workspace_usage_periods
       WHERE workspace_id = $1 AND period_start <= now() AND period_end > now()
       ORDER BY period_start DESC LIMIT 1`,
      [workspaceId],
    );

    const included = period ? Number(period.included_seals) : planLimit;
    const used = period ? Number(period.used_seals) : 0;
    return {
      workspaceId,
      plan: workspace.plan,
      included,
      used,
      remaining: Math.max(0, included - used),
      overageRate: null,
    };
  }));

  // ── GET /api/v1/workspaces/:workspaceId/usage ───────────────────────────

  server.get<{ Params: { workspaceId: string } }>("/api/v1/workspaces/:workspaceId/usage", withRateLimit<{ Params: { workspaceId: string } }>(async (request, reply) => {
    const { workspaceId } = request.params;

    const workspace = await queryOne<{ id: string; plan: string }>(
      "SELECT id, plan FROM workspaces WHERE id = $1",
      [workspaceId],
    );
    if (!workspace) {
      return reply.status(404).send({ error: "workspace_not_found" });
    }

    const planLimit = getPlanLimit(workspace.plan);
    const period = await queryOne<{
      used_seals: number; included_seals: number;
      period_start: string; period_end: string;
    }>(
      `SELECT used_seals, included_seals, period_start, period_end
       FROM workspace_usage_periods
       WHERE workspace_id = $1 AND period_start <= now() AND period_end > now()
       ORDER BY period_start DESC LIMIT 1`,
      [workspaceId],
    );

    return {
      workspaceId,
      plan: workspace.plan,
      includedSeals: period?.included_seals ?? planLimit,
      usedSeals: period?.used_seals ?? 0,
      remainingSeals: (period?.included_seals ?? planLimit) - (period?.used_seals ?? 0),
      billingPeriodStart: period?.period_start ?? null,
      billingPeriodEnd: period?.period_end ?? null,
    };
  }));

  // ── GET /api/v1/workspaces/:workspaceId/seals ───────────────────────────

  server.get<{
    Params: { workspaceId: string };
    Querystring: { limit?: string; cursor?: string; status?: string; category?: string; from?: string; to?: string };
  }>("/api/v1/workspaces/:workspaceId/seals", withRateLimit<{ Params: { workspaceId: string }; Querystring: { limit?: string; cursor?: string; status?: string; category?: string; from?: string; to?: string } }>(async (request, reply) => {
    const { workspaceId } = request.params;
    const { limit: rawLimit, cursor, status, category, from, to } = request.query;

    const workspace = await queryOne<{ id: string }>(
      "SELECT id FROM workspaces WHERE id = $1",
      [workspaceId],
    );
    if (!workspace) {
      return reply.status(404).send({ error: "workspace_not_found" });
    }

    const limit = Math.min(Math.max(parseInt(rawLimit ?? "50", 10) || 50, 1), 100);
    const conditions: string[] = ["s.workspace_id = $1"];
    const params: unknown[] = [workspaceId];
    let idx = 2;

    if (status) { conditions.push(`s.status = $${idx}`); params.push(status); idx++; }
    if (from) { conditions.push(`s.created_at >= $${idx}`); params.push(from); idx++; }
    if (to) { conditions.push(`s.created_at <= $${idx}`); params.push(to); idx++; }
    if (cursor) { conditions.push(`s.created_at < $${idx}`); params.push(cursor); idx++; }
    if (category) {
      conditions.push(`EXISTS (SELECT 1 FROM seal_metadata sm WHERE sm.seal_id = s.id AND sm.key = 'category' AND sm.value_text = $${idx})`);
      params.push(category); idx++;
    }

    params.push(limit);

    const rows = await query<{
      id: string; title: string; subject: string; status: string;
      payload_sha256: string; sequence_no: string; created_at: string;
      proof_id: string | null;
    }>(
      `SELECT s.id, s.title, s.subject, s.status, s.payload_sha256, s.sequence_no, s.created_at,
              p.id AS proof_id
       FROM seals s
       LEFT JOIN proofs p ON p.seal_id = s.id
       WHERE ${conditions.join(" AND ")}
       ORDER BY s.created_at DESC LIMIT $${idx}`,
      params,
    );

    const seals = rows.map((r) => ({
      sealId: r.id,
      proofId: r.proof_id,
      title: r.title,
      subject: r.subject,
      status: r.status,
      hash: r.payload_sha256,
      sequence: parseInt(r.sequence_no, 10),
      createdAt: r.created_at,
    }));

    return {
      seals,
      count: seals.length,
      cursor: seals.length === limit ? seals[seals.length - 1]?.createdAt : null,
    };
  }));

  // ── GET /api/v1/seals/:sealId/certificate — PDF certificate download ───

  server.get<{ Params: { sealId: string } }>("/api/v1/seals/:sealId/certificate", withRateLimit<{ Params: { sealId: string } }>(async (request, reply) => {
    const { sealId } = request.params;

    const row = await queryOne<{
      seal_id: string; title: string; subject: string; description: string;
      payload_sha256: string; previous_hash: string; sequence_no: string;
      seal_created_at: string; display_name: string; proof_id: string | null;
    }>(
      `SELECT s.id AS seal_id, s.title, s.subject, s.description,
              s.payload_sha256, s.previous_hash, s.sequence_no,
              s.created_at AS seal_created_at, u.display_name,
              p.id AS proof_id
       FROM seals s
       JOIN users u ON s.actor_id = u.id
       LEFT JOIN proofs p ON p.seal_id = s.id
       WHERE s.id = $1`,
      [sealId],
    );

    if (!row) {
      return reply.status(404).send({ error: "seal_not_found" });
    }

    const ts = new Date(String(row.seal_created_at)).toLocaleString("en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", timeZoneName: "short",
    });
    const proofUrl = row.proof_id ? `${PROOF_BASE_URL}/proof/${row.proof_id}` : null;

    const doc = new PDFDocument({ size: "A4", margin: 60 });
    const stream = new PassThrough();
    doc.pipe(stream);

    // Header
    doc.fontSize(28).font("Helvetica-Bold").fillColor("#000000")
      .text("VYRDON CERTIFIED", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#666666")
      .text("Execution Certification Protocol", { align: "center" });

    // Divider
    doc.moveDown(1.2);
    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor("#00cc6a").lineWidth(2).stroke();
    doc.moveDown(1);

    // Certificate details
    const labelOpts = { continued: true };
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#333333");

    doc.text("Certificate ID:  ", labelOpts).font("Courier").fontSize(10).text(row.seal_id);
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(11).text("Title:  ", labelOpts).font("Helvetica").text(row.title);
    doc.moveDown(0.4);
    if (row.proof_id) {
      doc.font("Helvetica-Bold").text("Proof ID:  ", labelOpts).font("Courier").fontSize(10).text(row.proof_id);
      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(11);
    }
    doc.font("Helvetica-Bold").text("Subject:  ", labelOpts).font("Helvetica").text(row.subject);
    doc.moveDown(0.4);

    if (row.description) {
      doc.font("Helvetica-Bold").text("Description:  ", labelOpts).font("Helvetica").text(row.description);
      doc.moveDown(0.4);
    }

    doc.font("Helvetica-Bold").text("Performed by:  ", labelOpts).font("Helvetica").text(row.display_name);
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").text("Issued at:  ", labelOpts).font("Helvetica").text(ts);
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").text("Sequence:  ", labelOpts).font("Helvetica").text(`#${row.sequence_no}`);

    // Cryptographic section
    doc.moveDown(1.2);
    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor("#cccccc").lineWidth(0.5).stroke();
    doc.moveDown(0.8);

    doc.font("Helvetica-Bold").fontSize(12).fillColor("#000000").text("Record Integrity");
    doc.moveDown(0.6);

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#333333").text("SHA-256 HASH");
    doc.font("Courier").fontSize(9).fillColor("#006633").text(row.payload_sha256);
    doc.moveDown(0.4);

    if (row.previous_hash) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#333333").text("PREVIOUS HASH");
      doc.font("Courier").fontSize(9).fillColor("#006633").text(row.previous_hash);
      doc.moveDown(0.4);
    }

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#333333").text("CHAIN STATUS");
    doc.font("Helvetica").fontSize(9).fillColor("#006633").text("Linked — hash-chained to previous record");

    // Proof URL
    if (proofUrl) {
      doc.moveDown(1);
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#333333").text("PUBLIC PROOF URL");
      doc.font("Courier").fontSize(9).fillColor("#0066cc").text(proofUrl);
    }

    // Trust footer
    doc.moveDown(1.5);
    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor("#00cc6a").lineWidth(2).stroke();
    doc.moveDown(0.8);

    doc.font("Helvetica").fontSize(9).fillColor("#666666").text("This record is:", { align: "center" });
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9).fillColor("#333333")
      .text("✓ Cryptographically sealed    ✓ Time-stamped    ✓ Tamper-resistant    ✓ Publicly verifiable", { align: "center" });

    doc.moveDown(1);
    doc.font("Helvetica").fontSize(8).fillColor("#999999")
      .text("VYRDON — Execution Certification Protocol — vyrdon.com", { align: "center" });
    doc.text("Stop arguing about work. Certify it.", { align: "center" });

    doc.end();

    const safeName = row.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    return reply
      .type("application/pdf")
      .header("Content-Disposition", `attachment; filename="VYRDON-${safeName}.pdf"`)
      .send(stream);
  }));
}
