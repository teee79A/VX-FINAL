import type { FastifyInstance } from "fastify";
import {
  getPhase2EvidenceStatus,
  getPhase2OpsSupportStatus,
  isPhase2SliceEnabled,
} from "../lib/phase2-slice.js";
import { query } from "../db.js";

type PolicyBlocker = {
  id: string;
  severity: "P0" | "P1";
  status: "open";
  title: string;
  reason: string;
  source: string;
  evidence_ref: string | null;
  clearing_criteria: string;
  owner: string;
  observed_at: string;
  detail_api: string;
  recheck_api: string;
  details: Record<string, unknown>;
};

function pickEvidenceRef(payload: Record<string, unknown>): string | null {
  const status = payload["status"];
  if (status && typeof status === "object" && !Array.isArray(status)) {
    const row = status as Record<string, unknown>;
    if (typeof row["lastEventId"] === "string" && row["lastEventId"].trim()) {
      return row["lastEventId"];
    }
    if (typeof row["lastReceiptId"] === "string" && row["lastReceiptId"].trim()) {
      return row["lastReceiptId"];
    }
    if (typeof row["lastManifestId"] === "string" && row["lastManifestId"].trim()) {
      return row["lastManifestId"];
    }
  }

  const totals = payload["totals"];
  if (totals && typeof totals === "object" && !Array.isArray(totals)) {
    const row = totals as Record<string, unknown>;
    if (typeof row["lastEventId"] === "string" && row["lastEventId"].trim()) {
      return row["lastEventId"];
    }
  }

  return null;
}

export async function buildPolicyBlockers(): Promise<PolicyBlocker[]> {
  const observedAt = new Date().toISOString();

  if (!isPhase2SliceEnabled()) {
    return [];
  }

  const blockers: PolicyBlocker[] = [];

  let services: Awaited<ReturnType<typeof getPhase2OpsSupportStatus>> = [];
  try {
    services = await getPhase2OpsSupportStatus();
  } catch (error) {
    blockers.push({
      id: "ops_support_unreachable",
      severity: "P0",
      status: "open",
      title: "Ops support status is unreachable",
      reason: error instanceof Error ? error.message : String(error),
      source: "phase2-ops-support",
      evidence_ref: null,
      clearing_criteria: "All phase-2 worker/service status endpoints must respond with healthy state.",
      owner: "ops-service",
      observed_at: observedAt,
      detail_api: "/api/policy/blockers/ops_support_unreachable",
      recheck_api: "/api/policy/blockers/ops_support_unreachable/recheck",
      details: {},
    });
    return blockers;
  }

  for (const service of services) {
    if (service.status === "healthy") continue;

    blockers.push({
      id: `service_${service.service}_${service.status}`,
      severity: service.status === "down" ? "P0" : "P1",
      status: "open",
      title: `Service ${service.service} is ${service.status}`,
      reason:
        service.status === "down"
          ? "Service status endpoint could not be reached or is failing."
          : "Service is running but reports failures/degraded counters.",
      source: service.statusUrl,
      evidence_ref: pickEvidenceRef(service.detail),
      clearing_criteria:
        "Service status must be healthy for two consecutive checks and failure counters must stop increasing.",
      owner: "ops-service",
      observed_at: observedAt,
      detail_api: `/api/policy/blockers/${encodeURIComponent(`service_${service.service}_${service.status}`)}`,
      recheck_api: `/api/policy/blockers/${encodeURIComponent(`service_${service.service}_${service.status}`)}/recheck`,
      details: {
        service: service.service,
        status: service.status,
        status_url: service.statusUrl,
        payload: service.detail,
      },
    });
  }

  try {
    const evidenceStatus = await getPhase2EvidenceStatus();
    const totals = ((evidenceStatus["totals"] ?? {}) as Record<string, unknown>);
    const evidenceJournal = Number(totals["evidenceJournal"] ?? 0);
    const manifests = Number(totals["manifests"] ?? 0);
    const attestations = Number(totals["attestations"] ?? 0);

    if (!Number.isFinite(evidenceJournal) || evidenceJournal <= 0) {
      blockers.push({
        id: "proof_spine_missing_journal",
        severity: "P0",
        status: "open",
        title: "Proof spine missing evidence journal",
        reason: "Evidence journal contains zero records.",
        source: "/api/evidence/summary",
        evidence_ref: null,
        clearing_criteria: "At least one evidence journal record must exist and be queryable.",
        owner: "evidence-service",
        observed_at: observedAt,
        detail_api: "/api/policy/blockers/proof_spine_missing_journal",
        recheck_api: "/api/policy/blockers/proof_spine_missing_journal/recheck",
        details: { totals },
      });
    }

    if (!Number.isFinite(manifests) || manifests <= 0) {
      blockers.push({
        id: "proof_spine_missing_manifest",
        severity: "P0",
        status: "open",
        title: "Proof spine missing manifest",
        reason: "No sealed manifest records are available.",
        source: "/api/evidence/summary",
        evidence_ref: null,
        clearing_criteria: "At least one manifest must exist and be retrievable by manifest id.",
        owner: "evidence-service",
        observed_at: observedAt,
        detail_api: "/api/policy/blockers/proof_spine_missing_manifest",
        recheck_api: "/api/policy/blockers/proof_spine_missing_manifest/recheck",
        details: { totals },
      });
    }

    if (!Number.isFinite(attestations) || attestations <= 0) {
      blockers.push({
        id: "proof_spine_missing_attestation",
        severity: "P0",
        status: "open",
        title: "Proof spine missing attestation",
        reason: "No attestation/signature records are available.",
        source: "/api/evidence/summary",
        evidence_ref: null,
        clearing_criteria: "At least one manifest attestation must be present and verifiable.",
        owner: "attestation-signer",
        observed_at: observedAt,
        detail_api: "/api/policy/blockers/proof_spine_missing_attestation",
        recheck_api: "/api/policy/blockers/proof_spine_missing_attestation/recheck",
        details: { totals },
      });
    }
  } catch (error) {
    blockers.push({
      id: "proof_spine_unreachable",
      severity: "P0",
      status: "open",
      title: "Proof spine status unavailable",
      reason: error instanceof Error ? error.message : String(error),
      source: "/api/evidence/summary",
      evidence_ref: null,
      clearing_criteria: "Evidence summary endpoint must return journal, manifest, and attestation totals.",
      owner: "evidence-service",
      observed_at: observedAt,
      detail_api: "/api/policy/blockers/proof_spine_unreachable",
      recheck_api: "/api/policy/blockers/proof_spine_unreachable/recheck",
      details: {},
    });
  }

  try {
    const roomSummaryRows = await query<{
      room_key: string;
      status_color: string;
      reason_code: string | null;
      reason_text: string | null;
      evidence_ref: string | null;
      next_action: string | null;
      owner: string | null;
      updated_at_utc: string;
    }>(
      `SELECT room_key, status_color, reason_code, reason_text, evidence_ref, next_action, owner, updated_at_utc
       FROM room_summary
       WHERE status_color <> 'green'`,
    );

    for (const row of roomSummaryRows) {
      const reasonCode = row.reason_code ?? "status_not_green";
      blockers.push({
        id: `room_${row.room_key}_${reasonCode}`.toLowerCase(),
        severity: row.status_color === "red" ? "P0" : "P1",
        status: "open",
        title: `Room ${row.room_key} is ${row.status_color}`,
        reason: row.reason_text ?? "Room summary is not in green state.",
        source: `/api/room-contract/rooms/${encodeURIComponent(row.room_key)}`,
        evidence_ref: row.evidence_ref,
        clearing_criteria: row.next_action
          ? `Complete action ${row.next_action} and update room summary to green with evidence.`
          : "Update room summary to green with evidence reference.",
        owner: row.owner ?? `${row.room_key}-service`,
        observed_at: row.updated_at_utc,
        detail_api: `/api/policy/blockers/${encodeURIComponent(`room_${row.room_key}_${reasonCode}`.toLowerCase())}`,
        recheck_api: `/api/policy/blockers/${encodeURIComponent(`room_${row.room_key}_${reasonCode}`.toLowerCase())}/recheck`,
        details: {
          room_key: row.room_key,
          status_color: row.status_color,
          reason_code: row.reason_code,
          next_action: row.next_action,
        },
      });
    }
  } catch {
    // Room summary table can be unavailable in stripped local environments.
  }

  return blockers;
}

export async function registerPolicyRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/policy/blockers", async () => {
    const blockers = await buildPolicyBlockers();
    return {
      source: isPhase2SliceEnabled() ? "phase2" : "local",
      generated_at: new Date().toISOString(),
      blockers,
      summary: {
        total: blockers.length,
        p0: blockers.filter((blocker) => blocker.severity === "P0").length,
        p1: blockers.filter((blocker) => blocker.severity === "P1").length,
      },
    };
  });

  server.get<{ Params: { blockerId: string } }>("/api/policy/blockers/:blockerId", async (req, reply) => {
    const blockers = await buildPolicyBlockers();
    const blocker = blockers.find((entry) => entry.id === req.params.blockerId);
    if (!blocker) {
      return reply.code(404).send({ error: "blocker_not_found" });
    }
    return {
      source: isPhase2SliceEnabled() ? "phase2" : "local",
      blocker,
    };
  });

  server.post<{ Params: { blockerId: string } }>("/api/policy/blockers/:blockerId/recheck", async (req, reply) => {
    const blockers = await buildPolicyBlockers();
    const blocker = blockers.find((entry) => entry.id === req.params.blockerId);
    if (!blocker) {
      return reply.code(404).send({ error: "blocker_not_found" });
    }
    return {
      source: isPhase2SliceEnabled() ? "phase2" : "local",
      blocker,
      rechecked_at: new Date().toISOString(),
    };
  });

  server.get<{ Params: { blockerId: string } }>("/api/policy/blockers/:blockerId/recheck", async (req, reply) => {
    const blockers = await buildPolicyBlockers();
    const blocker = blockers.find((entry) => entry.id === req.params.blockerId);
    if (!blocker) {
      return reply.code(404).send({ error: "blocker_not_found" });
    }
    return {
      source: isPhase2SliceEnabled() ? "phase2" : "local",
      blocker,
      rechecked_at: new Date().toISOString(),
    };
  });

  server.get("/api/policy/gate-evaluation", async () => {
    const blockers = await buildPolicyBlockers();
    const p0 = blockers.filter((entry) => entry.severity === "P0");
    const p1 = blockers.filter((entry) => entry.severity === "P1");

    return {
      source: isPhase2SliceEnabled() ? "phase2" : "local",
      evaluated_at: new Date().toISOString(),
      gate: {
        state: p0.length === 0 ? "pass" : "blocked",
        blocker_count: blockers.length,
        p0_count: p0.length,
        p1_count: p1.length,
      },
      clearing_criteria: {
        p0: "All P0 blockers must be cleared with linked evidence refs and recheck pass.",
        p1: "P1 blockers must have owner, action, ETA, and evidence-backed mitigation trail.",
      },
      actor_ownership: blockers.map((entry) => ({
        blocker_id: entry.id,
        owner: entry.owner,
        source: entry.source,
      })),
      blockers,
    };
  });
}
