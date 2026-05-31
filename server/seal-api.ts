import { createHash, randomUUID } from "node:crypto";
import { access, appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";

interface SealRequest {
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  payload?: Record<string, unknown>;
  workspace?: string;
}

interface SealRecord {
  sealId: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  payload: Record<string, unknown>;
  hash: string;
  chainHash: string;
  previousHash: string;
  timestamp: string;
  workspace: string;
  visibility: "public" | "customer" | "private";
  status: "VYRDON CERTIFIED TRUE";
  proof: string;
}

interface ProofView {
  sealId: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  hash: string;
  chainHash: string;
  timestamp: string;
  status: "VYRDON CERTIFIED TRUE";
  verification: "PASS" | "FAIL";
}

interface SealRouteOptions {
  evidenceDir?: string;
  proofBaseUrl?: string;
}

interface SealState {
  lastHash: string;
  sealStore: Map<string, SealRecord>;
  workspaceUsage: Map<string, number>;
}

const STATUS = "VYRDON CERTIFIED TRUE";

function defaultEvidenceDir(): string {
  if (process.env.EVIDENCE_DIR) {
    return process.env.EVIDENCE_DIR;
  }
  if (process.env.VXSTATION_SHARED_EVIDENCE_DIR) {
    return join(process.env.VXSTATION_SHARED_EVIDENCE_DIR, "seals");
  }
  return "/opt/vxstation/shared/evidence/journal/seals";
}

function computeHash(data: string): string {
  return `sha256:${createHash("sha256").update(data).digest("hex")}`;
}

function computeChainHash(previousHash: string, currentHash: string): string {
  return computeHash(`${previousHash}->${currentHash}`);
}

function serializeSealPayload(input: {
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  payload: Record<string, unknown>;
  timestamp: string;
}): string {
  return JSON.stringify(input);
}

function journalPath(evidenceDir: string): string {
  return join(evidenceDir, "seal-journal.jsonl");
}

async function persistSeal(evidenceDir: string, record: SealRecord): Promise<void> {
  await mkdir(evidenceDir, { recursive: true });
  await appendFile(journalPath(evidenceDir), `${JSON.stringify(record)}\n`, "utf8");
}

function checkUsage(workspaceUsage: Map<string, number>, workspace: string) {
  const count = workspaceUsage.get(workspace) ?? 0;
  if (count < 100) {
    return { allowed: true, count, tier: "free" };
  }
  return { allowed: true, count, tier: "growth" };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clampLimit(rawLimit: string | undefined): number {
  const parsed = Number.parseInt(rawLimit ?? "50", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 50;
  }
  return Math.min(parsed, 200);
}

async function loadState(evidenceDir: string): Promise<SealState> {
  const sealStore = new Map<string, SealRecord>();
  const workspaceUsage = new Map<string, number>();
  let lastHash = "genesis";

  try {
    await access(journalPath(evidenceDir));
  } catch {
    return { lastHash, sealStore, workspaceUsage };
  }

  const file = await readFile(journalPath(evidenceDir), "utf8");
  for (const line of file.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    const record = JSON.parse(line) as SealRecord;
    sealStore.set(record.sealId, record);
    workspaceUsage.set(record.workspace, (workspaceUsage.get(record.workspace) ?? 0) + 1);
    lastHash = record.chainHash;
  }

  return { lastHash, sealStore, workspaceUsage };
}

export async function registerSealRoutes(
  server: FastifyInstance,
  options: SealRouteOptions = {},
): Promise<void> {
  const evidenceDir = options.evidenceDir ?? defaultEvidenceDir();
  const proofBaseUrl = options.proofBaseUrl ?? process.env.PROOF_BASE_URL ?? "https://vyrdx.vyrdon.com";
  const state = await loadState(evidenceDir);

  server.post<{ Body: SealRequest }>("/api/v1/seal", async (request, reply) => {
    const body = request.body ?? ({} as SealRequest);
    const action = body.action?.trim();
    const entityType = body.entityType?.trim();
    const entityId = body.entityId?.trim();
    const actor = body.actor?.trim();
    const workspace = body.workspace?.trim() || "default";
    const payload = body.payload ?? {};

    if (!action || !entityType || !entityId || !actor) {
      return reply.status(400).send({
        error: "Missing required fields: action, entityType, entityId, actor",
      });
    }

    const usage = checkUsage(state.workspaceUsage, workspace);
    if (!usage.allowed) {
      return reply.status(429).send({ error: "Usage limit reached", usage });
    }

    const sealId = `vyrdon-seal-${randomUUID().slice(0, 8)}`;
    const timestamp = new Date().toISOString();
    const payloadString = serializeSealPayload({
      action,
      entityType,
      entityId,
      actor,
      payload,
      timestamp,
    });
    const hash = computeHash(payloadString);
    const previousHash = state.lastHash;
    const chainHash = computeChainHash(previousHash, hash);

    const record: SealRecord = {
      sealId,
      action,
      entityType,
      entityId,
      actor,
      payload,
      hash,
      chainHash,
      previousHash,
      timestamp,
      workspace,
      visibility: "public",
      status: STATUS,
      proof: `${proofBaseUrl}/proof/${sealId}`,
    };

    await persistSeal(evidenceDir, record);

    state.lastHash = chainHash;
    state.workspaceUsage.set(workspace, (state.workspaceUsage.get(workspace) ?? 0) + 1);
    state.sealStore.set(sealId, record);

    return reply.status(201).send({
      sealId: record.sealId,
      action: record.action,
      hash: record.hash,
      chainHash: record.chainHash,
      timestamp: record.timestamp,
      proof: record.proof,
      status: record.status,
      tier: usage.tier,
      usageCount: state.workspaceUsage.get(workspace) ?? 0,
    });
  });

  server.get<{ Params: { sealId: string } }>("/proof/:sealId", async (request, reply) => {
    const record = state.sealStore.get(request.params.sealId);
    if (!record) {
      return reply.status(404).send({ error: "Seal not found", sealId: request.params.sealId });
    }

    const recomputedHash = computeHash(
      serializeSealPayload({
        action: record.action,
        entityType: record.entityType,
        entityId: record.entityId,
        actor: record.actor,
        payload: record.payload,
        timestamp: record.timestamp,
      }),
    );
    const verification: ProofView["verification"] = recomputedHash === record.hash ? "PASS" : "FAIL";

    const proof: ProofView = {
      sealId: record.sealId,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      actor: record.actor,
      hash: record.hash,
      chainHash: record.chainHash,
      timestamp: record.timestamp,
      status: STATUS,
      verification,
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VYRDON Proof - ${escapeHtml(proof.sealId)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#f0f0f0;font-family:'Space Mono',monospace;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:2rem}
.proof{max-width:600px;width:100%;border:1px solid #2a2a2a;padding:3rem}
.mark{font-family:'Bebas Neue',sans-serif;font-size:2rem;letter-spacing:.15em;text-align:center;margin-bottom:.5rem}
.mark span{color:#00ff88}
.sub{text-align:center;font-size:.6rem;color:#444;letter-spacing:.4em;text-transform:uppercase;margin-bottom:2rem}
.field{margin-bottom:1rem}
.field-label{font-size:.6rem;color:#666;letter-spacing:.2em;text-transform:uppercase;margin-bottom:.3rem}
.field-value{font-size:.75rem;color:#ccc;word-break:break-all}
.hash{color:#00ff88;font-size:.65rem}
.status{font-family:'Bebas Neue',sans-serif;font-size:1.8rem;letter-spacing:.1em;color:${verification === "PASS" ? "#00ff88" : "#ff2244"};text-align:center;padding:1rem;border:2px solid ${verification === "PASS" ? "#00ff88" : "#ff2244"};margin-top:2rem}
.footer{text-align:center;margin-top:2rem;font-size:.5rem;color:#333}
</style>
</head>
<body>
<div class="proof">
  <div class="mark">VYRD<span>O</span>N</div>
  <div class="sub">Certified Execution Proof</div>
  <div class="field"><div class="field-label">Seal ID</div><div class="field-value">${escapeHtml(proof.sealId)}</div></div>
  <div class="field"><div class="field-label">Action</div><div class="field-value">${escapeHtml(proof.action)}</div></div>
  <div class="field"><div class="field-label">Entity</div><div class="field-value">${escapeHtml(proof.entityType)} / ${escapeHtml(proof.entityId)}</div></div>
  <div class="field"><div class="field-label">Actor</div><div class="field-value">${escapeHtml(proof.actor)}</div></div>
  <div class="field"><div class="field-label">Timestamp</div><div class="field-value">${escapeHtml(proof.timestamp)}</div></div>
  <div class="field"><div class="field-label">Hash</div><div class="field-value hash">${escapeHtml(proof.hash)}</div></div>
  <div class="field"><div class="field-label">Chain Hash</div><div class="field-value hash">${escapeHtml(proof.chainHash)}</div></div>
  <div class="status">VYRDON CERTIFIED TRUE = ${proof.verification}</div>
  <div class="footer">&copy; 2026 VYRDON - Certified Execution Protocol</div>
</div>
</body>
</html>`;

    return reply.type("text/html").send(html);
  });

  server.get<{ Querystring: { workspace?: string; limit?: string } }>("/api/v1/seals", async (request) => {
    const workspace = request.query.workspace?.trim() || "default";
    const limit = clampLimit(request.query.limit);
    const seals = Array.from(state.sealStore.values())
      .filter((record) => record.workspace === workspace)
      .slice(-limit)
      .map((record) => ({
        sealId: record.sealId,
        action: record.action,
        entityType: record.entityType,
        entityId: record.entityId,
        timestamp: record.timestamp,
        hash: record.hash,
        proof: record.proof,
        status: record.status,
      }));

    return {
      workspace,
      count: seals.length,
      usage: state.workspaceUsage.get(workspace) ?? 0,
      seals,
    };
  });

  server.get<{ Querystring: { workspace?: string } }>("/api/v1/usage", async (request) => {
    const workspace = request.query.workspace?.trim() || "default";
    const count = state.workspaceUsage.get(workspace) ?? 0;
    const freeRemaining = Math.max(0, 100 - count);
    const billable = Math.max(0, count - 100);

    return {
      workspace,
      totalSeals: count,
      freeUsed: Math.min(count, 100),
      freeRemaining,
      billableSeals: billable,
      estimatedCharge: billable * 0.1,
      tier: count <= 100 ? "starter" : "growth",
    };
  });

  server.get<{ Params: { hash: string } }>("/api/v1/verify/:hash", async (request) => {
    const found = Array.from(state.sealStore.values()).find(
      (record) => record.hash === request.params.hash || record.chainHash === request.params.hash,
    );

    if (!found) {
      return {
        verified: false,
        hash: request.params.hash,
        message: "Hash not found in seal chain",
      };
    }

    return {
      verified: true,
      hash: request.params.hash,
      sealId: found.sealId,
      action: found.action,
      timestamp: found.timestamp,
      proof: found.proof,
      status: STATUS,
    };
  });

  // POST /api/v1/seals — plural alias for /api/v1/seal (REST convention)
  server.post<{ Body: SealRequest }>("/api/v1/seals", async (request, reply) => {
    const body = request.body ?? ({} as SealRequest);
    const action = body.action?.trim();
    const entityType = body.entityType?.trim();
    const entityId = body.entityId?.trim();
    const actor = body.actor?.trim();
    const workspace = body.workspace?.trim() || "default";
    const payload = body.payload ?? {};

    if (!action || !entityType || !entityId || !actor) {
      return reply.status(400).send({
        error: "Missing required fields: action, entityType, entityId, actor",
      });
    }

    const usage = checkUsage(state.workspaceUsage, workspace);
    if (!usage.allowed) {
      return reply.status(429).send({ error: "Usage limit reached", usage });
    }

    const sealId = `vyrdon-seal-${randomUUID().slice(0, 8)}`;
    const timestamp = new Date().toISOString();
    const payloadString = serializeSealPayload({ action, entityType, entityId, actor, payload, timestamp });
    const hash = computeHash(payloadString);
    const previousHash = state.lastHash;
    const chainHash = computeChainHash(previousHash, hash);

    const record: SealRecord = {
      sealId, action, entityType, entityId, actor, payload,
      hash, chainHash, previousHash, timestamp, workspace,
      visibility: "public", status: STATUS,
      proof: `${proofBaseUrl}/proof/${sealId}`,
    };

    await persistSeal(evidenceDir, record);
    state.lastHash = chainHash;
    state.workspaceUsage.set(workspace, (state.workspaceUsage.get(workspace) ?? 0) + 1);
    state.sealStore.set(sealId, record);

    return reply.status(201).send({
      sealId: record.sealId, action: record.action, hash: record.hash,
      chainHash: record.chainHash, timestamp: record.timestamp, proof: record.proof,
      status: record.status, tier: usage.tier,
      usageCount: state.workspaceUsage.get(workspace) ?? 0,
    });
  });

  // GET /api/v1/proofs/:proofId — JSON proof endpoint
  server.get<{ Params: { proofId: string } }>("/api/v1/proofs/:proofId", async (request, reply) => {
    const record = state.sealStore.get(request.params.proofId);
    if (!record) {
      return reply.status(404).send({ error: "Proof not found", proofId: request.params.proofId });
    }

    const recomputedHash = computeHash(serializeSealPayload({
      action: record.action, entityType: record.entityType, entityId: record.entityId,
      actor: record.actor, payload: record.payload, timestamp: record.timestamp,
    }));

    return {
      sealId: record.sealId,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      actor: record.actor,
      hash: record.hash,
      chainHash: record.chainHash,
      timestamp: record.timestamp,
      status: STATUS,
      verification: recomputedHash === record.hash ? "PASS" : "FAIL",
      proofUrl: `${proofBaseUrl}/proof/${record.sealId}`,
    };
  });
}
