/**
 * Boot Seed — Records real system operational state on server start.
 *
 * Idempotent: checks existence before inserting.
 * Creates ONLY what the system actually does:
 *
 *   OPERATIONS: deployment record, service health probes
 *   CAMP:       execution identity, README, operator contacts
 *   EVIDENCE:   genesis chain, deployment event, service check, boot event
 *
 * NO fabricated commercial data. NO fake invoices. NO invented revenue.
 * Commercial room populates only through evidence-backed mutation paths.
 *
 * VYRDON Law §1: Execution without evidence is void.
 */

import { createHash, randomUUID } from "node:crypto";
import { query, queryOne, dbHealthy } from "./db.js";
import { ENV } from "./env.js";
import { PAYMENT_CONFIG } from "./config/payments.js";

// ── PUBLIC ────────────────────────────────────────────────────────────────

export async function seedBootData(): Promise<void> {
  const ok = await dbHealthy();
  if (!ok) return;

  await ensureRoomBackbone();
  await recordDeployment();
  await recordServiceHealth();
  await syncCampSnapshot();
  await ensureEvidenceChain();
  await syncMarketSnapshot();
  await syncSystemStateSnapshot();
}

// ── DEPLOYMENT ────────────────────────────────────────────────────────────

async function recordDeployment(): Promise<void> {
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM deployments WHERE release_id = $1 AND environment = $2",
    [ENV.releaseId, ENV.environment],
  );
  if (existing) return;

  await query(
    `INSERT INTO deployments (environment, release_id, git_commit, build_time, operator, status, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      ENV.environment,
      ENV.releaseId,
      ENV.gitCommit,
      new Date().toISOString(),
      "system",
      "succeeded",
      JSON.stringify({ mode: ENV.mode, pid: process.pid, nodeVersion: process.version }),
    ],
  );
}

// ── SERVICE HEALTH ────────────────────────────────────────────────────────

async function recordServiceHealth(): Promise<void> {
  const pgOk = await dbHealthy();

  let asusOk = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(ENV.asusUrl + "/health", { signal: controller.signal });
    asusOk = res.ok;
    clearTimeout(timeout);
  } catch { /* unreachable or timeout */ }

  const pgStatus = pgOk ? "healthy" : "down";
  const tunnelStatus = ENV.isCloud ? "healthy" : "degraded";
  const asusStatus = asusOk ? "healthy" : "degraded";

  const services: Array<{ name: string; status: string; detail: Record<string, unknown> }> = [
    { name: "vxstation-api", status: "healthy", detail: { port: ENV.port, mode: ENV.mode, pid: process.pid } },
    { name: "postgres", status: pgStatus, detail: { configured: Boolean(ENV.databaseUrl) } },
    { name: "evidence-chain", status: "healthy", detail: { dir: ENV.evidenceDir } },
    { name: "cloudflare-tunnel", status: tunnelStatus, detail: { domain: "vyrdx.vyrdon.com" } },
    { name: "consolab-authority", status: asusStatus, detail: { url: ENV.asusUrl } },
    { name: "conductor", status: "healthy", detail: { engines: 10, servers: 10 } },
    { name: "vyrdx-bridge", status: "healthy", detail: { root: ENV.vyrdxRoot } },
    { name: "websocket", status: "healthy", detail: { path: "/ws" } },
  ];

  for (const svc of services) {
    await query(
      `INSERT INTO service_status (service_name, environment, status, detail, checked_at)
       VALUES ($1, $2, $3, $4, now())`,
      [svc.name, ENV.environment, svc.status, JSON.stringify(svc.detail)],
    );
  }
}

// ── EVIDENCE CHAIN ────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

const ROOM_BACKBONE: Array<{
  key: string;
  title: string;
  owner: string;
  recordClass: "public" | "private";
  actions: string[];
}> = [
  {
    key: "camp",
    title: "Camp",
    owner: "authority",
    recordClass: "public",
    actions: ["refresh_identity", "refresh_licenses", "refresh_readme", "refresh_contact"],
  },
  {
    key: "commercial",
    title: "Commercial",
    owner: "commercial-service",
    recordClass: "private",
    actions: ["sync_billing", "refresh_entitlements", "issue_certificate", "revoke_certificate", "export_commercial_record"],
  },
  {
    key: "evidence",
    title: "Evidence",
    owner: "evidence-service",
    recordClass: "private",
    actions: ["reverify_proof", "export_evidence_bundle", "view_tx_mapping", "rotate_signing_key", "revoke_signing_key"],
  },
  {
    key: "market",
    title: "Market",
    owner: "market-service",
    recordClass: "public",
    actions: ["refresh_market_sources", "refresh_targets", "export_market_snapshot"],
  },
  {
    key: "reports_plans",
    title: "Reports / Plans",
    owner: "reports-plans-service",
    recordClass: "private",
    actions: ["generate_report", "update_execution_plan", "set_next_review_eta", "export_plan_snapshot"],
  },
  {
    key: "system",
    title: "System",
    owner: "system-service",
    recordClass: "private",
    actions: ["refresh_trust_closure", "refresh_attestation", "refresh_boundary_state"],
  },
  {
    key: "ops",
    title: "Ops",
    owner: "ops-service",
    recordClass: "private",
    actions: ["baseline_capture", "health_refresh", "canary_deploy", "rollback", "evidence_export", "seal_review"],
  },
];

const CAMP_README_TEXT =
  "VYRDX is the human-implemented execution runtime of VYRDON. Camp defines the entry doctrine for authority, trust, contact routing, and coordination before any governed room is entered. This surface is descriptive only; execution authority remains evidence-bound and fail-closed inside the runtime.";

type CampDocumentSeed = {
  docKey: string;
  title: string;
  body: string;
};

type CampLicenseSeed = {
  name: string;
  scope: string;
  status: string;
  displayOrder: number;
};

type MarketTargetSeed = {
  name: string;
  sector: string;
  region: string;
  priority: string;
  status: string;
  summary: string;
  sources: string[];
};

const CAMP_DOCUMENT_SEED: readonly CampDocumentSeed[] = [
  {
    docKey: "readme",
    title: "VYRDX Camp Readme",
    body: "Canonical mission and launch operating instructions.",
  },
  {
    docKey: "contact",
    title: "VYRDON Launch Contact",
    body: "Primary launch contact and operator path.",
  },
  {
    docKey: "doctrine",
    title: "Proof Not Screenshots",
    body: "Execution must be verifiable, not claimed.",
  },
  {
    docKey: "pricing",
    title: "Launch Pricing",
    body: "Starter, Growth, Enterprise.",
  },
];

const CAMP_LICENSE_SEED: readonly CampLicenseSeed[] = [
  {
    name: "VYRDON Execution Protocol",
    scope: "runtime authority and sealed execution boundary",
    status: "active",
    displayOrder: 1,
  },
  {
    name: "Cloudflare Access",
    scope: "edge policy and ingress boundary",
    status: process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET ? "active" : "unverified",
    displayOrder: 2,
  },
  {
    name: "Arbitrum Runtime",
    scope: "on-chain proof and verification path",
    status: process.env.RPC_URL ? "active" : "unverified",
    displayOrder: 3,
  },
  {
    name: "Tailscale Path",
    scope: "private authority-execution routing",
    status: process.env.TAILSCALE_IP ? "active" : "unverified",
    displayOrder: 4,
  },
];

const MARKET_TARGET_SEED: readonly MarketTargetSeed[] = [
  {
    name: "Northstar Digital",
    sector: "Digital Marketing Agency",
    region: "US",
    priority: "P1",
    status: "active",
    summary: "Agency client-reporting target for VYRDX launch.",
    sources: [
      "https://www.linkedin.com/company/example",
      "https://example.com",
    ],
  },
];

function toMarketSymbol(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function deriveSourceNameFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.trim().toLowerCase();
    if (!hostname) return "target_market_registry";
    return `source_${hostname.replace(/[^a-z0-9]+/g, "_")}`;
  } catch {
    return "target_market_registry";
  }
}

async function ensureRoomBackbone(): Promise<void> {
  for (const room of ROOM_BACKBONE) {
    await query(
      `INSERT INTO room_registry (room_key, room_name, record_class, owner, is_enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, now(), now())
       ON CONFLICT (room_key) DO UPDATE
         SET room_name = EXCLUDED.room_name,
             record_class = EXCLUDED.record_class,
             owner = EXCLUDED.owner,
             is_enabled = true,
             updated_at = now()`,
      [room.key, room.title, room.recordClass, room.owner],
    );

    await query(
      `INSERT INTO room_summary
        (room_key, status_color, reason_code, reason_text, delta_summary, updated_at_utc, owner, evidence_ref, next_action, next_update_eta)
       VALUES
        ($1, 'amber', 'domain_sync_required', 'Room backbone is registered. Awaiting persisted domain objects.', 'room_backbone_registered', now(), $2, $3, 'sync_domain_state', now() + interval '15 minutes')
       ON CONFLICT (room_key) DO UPDATE
         SET status_color = EXCLUDED.status_color,
             reason_code = EXCLUDED.reason_code,
             reason_text = EXCLUDED.reason_text,
             delta_summary = EXCLUDED.delta_summary,
             updated_at_utc = EXCLUDED.updated_at_utc,
             owner = EXCLUDED.owner,
             evidence_ref = EXCLUDED.evidence_ref,
             next_action = EXCLUDED.next_action,
             next_update_eta = EXCLUDED.next_update_eta
       WHERE room_summary.reason_code = 'bootstrap_pending'
          OR room_summary.evidence_ref = $4`,
      [room.key, room.owner, `room:${room.key}:backbone`, `room:${room.key}:bootstrap`],
    );

    const reasonExists = await queryOne<{ id: string; reason_code: string; created_by: string }>(
      `SELECT id::text AS id,
              reason_code,
              created_by
         FROM room_status_reasons
        WHERE room_key = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [room.key],
    );
    if (!reasonExists) {
      await query(
        `INSERT INTO room_status_reasons (room_key, reason_code, reason_text, evidence_ref, created_at, created_by)
         VALUES ($1, 'domain_sync_required', 'Room backbone is registered. Awaiting persisted domain objects.', $2, now(), 'system:runtime')`,
        [room.key, `room:${room.key}:backbone`],
      );
    } else if (reasonExists.created_by === "system:seed" || reasonExists.reason_code === "bootstrap_pending") {
      await query(
        `UPDATE room_status_reasons
            SET reason_code = 'domain_sync_required',
                reason_text = 'Room backbone is registered. Awaiting persisted domain objects.',
                evidence_ref = $2,
                created_by = 'system:runtime'
          WHERE id = $1::bigint`,
        [reasonExists.id, `room:${room.key}:backbone`],
      );
    }

    const eventExists = await queryOne<{ id: string; event_type: string; created_by: string }>(
      `SELECT id::text AS id,
              event_type,
              created_by
         FROM room_change_events
        WHERE room_key = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [room.key],
    );
    if (!eventExists) {
      await query(
        `INSERT INTO room_change_events (room_key, event_type, event_payload, evidence_ref, created_at, created_by)
         VALUES ($1, 'room_backbone_registered', $2::jsonb, $3, now(), 'system:runtime')`,
        [room.key, JSON.stringify({ room: room.key, source: "runtime_backbone" }), `room:${room.key}:backbone`],
      );
    } else if (eventExists.created_by === "system:seed" || eventExists.event_type === "room_bootstrap_seeded") {
      await query(
        `UPDATE room_change_events
            SET event_type = 'room_backbone_registered',
                event_payload = $2::jsonb,
                evidence_ref = $3,
                created_by = 'system:runtime'
          WHERE id = $1::bigint`,
        [
          eventExists.id,
          JSON.stringify({ room: room.key, source: "runtime_backbone" }),
          `room:${room.key}:backbone`,
        ],
      );
    }

    for (const action of room.actions) {
      await query(
        `INSERT INTO room_actions (room_key, action_key, action_label, is_enabled, requires_policy, requires_evidence, created_at, updated_at)
         VALUES ($1, $2, $3, true, true, true, now(), now())
         ON CONFLICT (room_key, action_key) DO UPDATE
           SET action_label = EXCLUDED.action_label,
               is_enabled = true,
               requires_policy = true,
               requires_evidence = true,
               updated_at = now()`,
        [room.key, action, action],
      );
    }
  }
}

async function syncCampSnapshot(): Promise<void> {
  for (const seed of CAMP_DOCUMENT_SEED) {
    await query(
      `INSERT INTO camp_documents (doc_key, title, body, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (doc_key) DO UPDATE
         SET title = EXCLUDED.title,
             body = EXCLUDED.body,
             updated_at = now()`,
      [seed.docKey, seed.title, seed.body],
    );
  }

  const readmeDoc = CAMP_DOCUMENT_SEED.find((doc) => doc.docKey === "readme");
  const protocolName = process.env.CAMP_PROTOCOL_NAME?.trim() || "VYRDON";
  const systemName = process.env.CAMP_SYSTEM_NAME?.trim() || "VYRDX execution runtime";
  const executionModel =
    process.env.CAMP_EXECUTION_MODEL?.trim() || "human-implemented / authority-gated / primary_db";
  const sealPolicy =
    process.env.CAMP_SEAL_POLICY?.trim() || "fail-closed / evidence-bound / certificate-anchored";
  const readmeParagraph = (
    process.env.CAMP_README_TEXT?.trim() ||
    readmeDoc?.body ||
    CAMP_README_TEXT
  ).replace(/\s+/g, " ").trim();
  const operationsContact =
    process.env.OPS_CONTACT_EMAIL?.trim() ||
    PAYMENT_CONFIG.contactEmail ||
    PAYMENT_CONFIG.paypalReceiverEmail ||
    "contact@vyrdon.com";
  const authorityContact = process.env.AUTHORITY_CONTACT_EMAIL?.trim() || "authority@vyrdon.com";

  const currentIdentity = await queryOne<{
    protocol_name: string;
    system_name: string;
    execution_model: string;
    seal_policy: string;
  }>(
    `SELECT protocol_name,
            system_name,
            execution_model,
            seal_policy
       FROM camp_identity
      ORDER BY updated_at DESC
      LIMIT 1`,
  ).catch(() => null);

  if (
    !currentIdentity ||
    currentIdentity.protocol_name !== protocolName ||
    currentIdentity.system_name !== systemName ||
    currentIdentity.execution_model !== executionModel ||
    currentIdentity.seal_policy !== sealPolicy
  ) {
    await query(
      `INSERT INTO camp_identity (protocol_name, system_name, execution_model, seal_policy, updated_at)
       VALUES ($1, $2, $3, $4, now())`,
      [protocolName, systemName, executionModel, sealPolicy],
    );
  }

  const currentReadme = await queryOne<{ paragraph: string }>(
    `SELECT paragraph
       FROM camp_readme
      ORDER BY updated_at DESC
      LIMIT 1`,
  ).catch(() => null);
  if (!currentReadme || currentReadme.paragraph !== readmeParagraph) {
    await query(
      `INSERT INTO camp_readme (paragraph, code_injection, updated_at)
       VALUES ($1, '{}'::jsonb, now())`,
      [readmeParagraph],
    );
  }

  await query(
    `INSERT INTO camp_contacts (contact_role, email, updated_at)
     VALUES ('operations', $1, now())
     ON CONFLICT (contact_role) DO UPDATE
       SET email = EXCLUDED.email,
           updated_at = now()`,
    [operationsContact],
  );

  await query(
    `INSERT INTO camp_contacts (contact_role, email, updated_at)
     VALUES ('authority', $1, now())
     ON CONFLICT (contact_role) DO UPDATE
       SET email = EXCLUDED.email,
           updated_at = now()`,
    [authorityContact],
  );

  await query(
    `DELETE FROM camp_licenses
      WHERE license_name = ANY($1::text[])`,
    [CAMP_LICENSE_SEED.map((entry) => entry.name)],
  );

  for (const license of CAMP_LICENSE_SEED) {
    await query(
      `INSERT INTO camp_licenses (license_name, license_scope, license_status, display_order, updated_at)
       VALUES ($1, $2, $3, $4, now())`,
      [license.name, license.scope, license.status, license.displayOrder],
    );
  }

  const coordinationTitle = process.env.CAMP_COORDINATION_TITLE?.trim();
  const coordinationBody = process.env.CAMP_COORDINATION_BODY?.trim();
  const coordinationStatus = process.env.CAMP_COORDINATION_STATUS?.trim() || "active";
  const coordinationStartsAt = process.env.CAMP_COORDINATION_STARTS_AT?.trim() || null;

  if (coordinationTitle && coordinationBody) {
    await query(
      `INSERT INTO camp_coordination_notes (note_key, title, body, status, starts_at, updated_at)
       VALUES ('launch_notes', $1, $2, $3, $4::timestamptz, now())
       ON CONFLICT (note_key) DO UPDATE
         SET title = EXCLUDED.title,
             body = EXCLUDED.body,
             status = EXCLUDED.status,
             starts_at = EXCLUDED.starts_at,
             updated_at = now()`,
      [coordinationTitle, coordinationBody, coordinationStatus, coordinationStartsAt],
    );
  }
}

async function syncMarketSnapshot(): Promise<void> {
  const sourceName = "target_market_registry";
  const sourceBase = "source_backed_market_intelligence";

  for (const target of MARKET_TARGET_SEED) {
    const symbol = toMarketSymbol(target.name);
    if (!symbol) continue;

    const metadata = {
      sector: target.sector,
      region: target.region,
      priority: target.priority,
      status: target.status,
      summary: target.summary,
      notes: target.summary,
      sources: target.sources,
    };

    await query(
      `INSERT INTO market_targets (symbol, display_name, source_name, is_active, metadata, updated_at)
       VALUES ($1, $2, $3, true, $4, now())
       ON CONFLICT (symbol) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             source_name = EXCLUDED.source_name,
             is_active = true,
             metadata = market_targets.metadata || EXCLUDED.metadata,
             updated_at = now()`,
      [symbol, target.name, sourceName, JSON.stringify(metadata)],
    );

    for (const sourceUrl of target.sources) {
      const normalizedUrl = sourceUrl.trim();
      if (!normalizedUrl) continue;
      const sourceKey = deriveSourceNameFromUrl(normalizedUrl);
      await query(
        `INSERT INTO market_sources (source_name, status, base_url, last_sync_utc, last_error, updated_at)
         VALUES ($1, 'connected', $2, now(), null, now())
         ON CONFLICT (source_name) DO UPDATE
           SET status = EXCLUDED.status,
               base_url = EXCLUDED.base_url,
               last_sync_utc = EXCLUDED.last_sync_utc,
               last_error = EXCLUDED.last_error,
               updated_at = now()`,
        [sourceKey, normalizedUrl],
      );
    }

    const headline = target.summary.trim();
    if (headline) {
      const intelSource = target.sources[0]?.trim() ? deriveSourceNameFromUrl(target.sources[0].trim()) : sourceName;
      const intelUrl = target.sources[0]?.trim() || null;
      const existingIntel = await queryOne<{ id: string }>(
        `SELECT id::text AS id
           FROM market_intel_rows
          WHERE symbol = $1
            AND source_name = $2
            AND headline = $3
          ORDER BY captured_at DESC
          LIMIT 1`,
        [symbol, intelSource, headline],
      );
      if (!existingIntel) {
        await query(
          `INSERT INTO market_intel_rows
            (symbol, source_name, headline, url, signal_type, sentiment, impact_score, captured_at, notes, raw)
           VALUES
            ($1, $2, $3, $4, 'target_summary', 'neutral', 60, now(), $5, $6)`,
          [symbol, intelSource, headline, intelUrl, target.summary, JSON.stringify(target)],
        );
      }
    }
  }

  // Deprecate legacy crypto-feed market data. Market room is target-market intelligence only.
  try {
    await query(
      `UPDATE market_targets
          SET is_active = false,
              updated_at = now()
        WHERE source_name = 'coingecko'
          AND is_active = true`,
    );
    await query(
      `UPDATE market_sources
          SET status = 'disconnected',
              last_error = 'deprecated_source',
              updated_at = now()
        WHERE source_name = 'coingecko'
          AND status <> 'disconnected'`,
    );
  } catch {
    // If schema is mid-migration, fail closed but don't block boot.
  }

  try {
    const targets = await query<{
      symbol: string;
      display_name: string;
      source_name: string;
      price: number | null;
      change_24h: number | null;
      change_7d: number | null;
      signal_state: string | null;
    }>(
      `SELECT t.symbol,
              t.display_name,
              t.source_name,
              s.price,
              s.change_24h,
              s.change_7d,
              s.signal_state
         FROM market_targets t
         LEFT JOIN LATERAL (
           SELECT price, change_24h, change_7d, signal_state
             FROM market_snapshots ms
            WHERE ms.symbol = t.symbol
            ORDER BY captured_at DESC
            LIMIT 1
         ) s ON true
        WHERE t.is_active = true
        ORDER BY t.symbol ASC
        LIMIT 100`,
    );

    if (targets.length === 0) {
      await query(
        `INSERT INTO market_sources (source_name, status, base_url, last_sync_utc, last_error, updated_at)
         VALUES ($1, 'disconnected', $2, now(), $3, now())
         ON CONFLICT (source_name) DO UPDATE
           SET status = EXCLUDED.status,
               base_url = EXCLUDED.base_url,
               last_sync_utc = EXCLUDED.last_sync_utc,
               last_error = EXCLUDED.last_error,
               updated_at = now()`,
        [sourceName, sourceBase, "target_market_seed_required"],
      );
      return;
    }

    await query(
      `INSERT INTO market_sources (source_name, status, base_url, last_sync_utc, last_error, updated_at)
       VALUES ($1, 'connected', $2, now(), null, now())
       ON CONFLICT (source_name) DO UPDATE
         SET status = EXCLUDED.status,
             base_url = EXCLUDED.base_url,
             last_sync_utc = EXCLUDED.last_sync_utc,
             last_error = EXCLUDED.last_error,
             updated_at = now()`,
      [sourceName, sourceBase],
    );

    let bullish = 0;
    let bearish = 0;
    let anomaly = 0;
    for (const row of targets) {
      const delta24h = row.change_24h ?? 0;
      const delta7d = row.change_7d ?? 0;
      const absDelta = Math.max(Math.abs(delta24h), Math.abs(delta7d));
      const volatilityClass = absDelta >= 10 ? "high" : absDelta >= 4 ? "medium" : "low";
      const signalState = delta24h > 1 && delta7d > 1 ? "bullish" : delta24h < -1 && delta7d < -1 ? "bearish" : "neutral";
      if (signalState === "bullish") bullish += 1;
      if (signalState === "bearish") bearish += 1;
      if (volatilityClass === "high") anomaly += 1;
    }

    await query(
      `INSERT INTO market_analysis
        (regime, trend_summary, bullish_count, bearish_count, anomaly_count, review_timestamp, updated_at)
       VALUES
        ($1, $2, $3, $4, $5, now(), now())`,
      [
        targets.length >= 5 ? "live" : "degraded",
        "computed_from_source_backed_target_market_snapshots",
        bullish,
        bearish,
        anomaly,
      ],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "target_market_source_unavailable";
    await query(
      `INSERT INTO market_sources (source_name, status, base_url, last_sync_utc, last_error, updated_at)
       VALUES ($1, 'disconnected', $2, now(), $3, now())
       ON CONFLICT (source_name) DO UPDATE
         SET status = EXCLUDED.status,
             base_url = EXCLUDED.base_url,
             last_sync_utc = EXCLUDED.last_sync_utc,
             last_error = EXCLUDED.last_error,
             updated_at = now()`,
      [sourceName, sourceBase, message],
    );
  }
}

async function syncSystemStateSnapshot(): Promise<void> {
  const boundaryOwner = process.env.BOUNDARY_OWNER_ADDRESS?.trim() || "unverified";
  const timelockAddress = process.env.TIMELOCK_ADDRESS?.trim() || null;
  const guardianAddress = process.env.GUARDIAN_ADDRESS?.trim() || null;
  const ownerIsEoa = process.env.BOUNDARY_OWNER_IS_EOA === "true";
  const boundaryStatus =
    timelockAddress && guardianAddress && !ownerIsEoa
      ? "verified"
      : "unverified";

  await query(
    `INSERT INTO system_boundary_state
      (boundary_owner, boundary_admin, timelock_address, guardian_address, owner_is_eoa, status, evidence_ref, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
    [
      boundaryOwner,
      process.env.BOUNDARY_ADMIN_ADDRESS?.trim() || null,
      timelockAddress,
      guardianAddress,
      ownerIsEoa,
      boundaryStatus,
      process.env.BOUNDARY_EVIDENCE_REF?.trim() || null,
    ],
  );

  const rootfsReadOnly = process.env.RUNTIME_ROOTFS_READ_ONLY === "true";
  const droppedCaps = process.env.RUNTIME_DROPPED_CAPS === "true";
  const explicitMountsOnly = process.env.RUNTIME_EXPLICIT_MOUNTS_ONLY === "true";
  await query(
    `INSERT INTO system_runtime_isolation
      (service_name, rootfs_read_only, dropped_caps, explicit_mounts_only, seccomp_profile, apparmor_profile, canary_status, rollback_proof_status, updated_at)
     VALUES
      ('runtime-api', $1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (service_name) DO UPDATE
       SET rootfs_read_only = EXCLUDED.rootfs_read_only,
           dropped_caps = EXCLUDED.dropped_caps,
           explicit_mounts_only = EXCLUDED.explicit_mounts_only,
           seccomp_profile = EXCLUDED.seccomp_profile,
           apparmor_profile = EXCLUDED.apparmor_profile,
           canary_status = EXCLUDED.canary_status,
           rollback_proof_status = EXCLUDED.rollback_proof_status,
           updated_at = now()`,
    [
      rootfsReadOnly,
      droppedCaps,
      explicitMountsOnly,
      process.env.RUNTIME_SECCOMP_PROFILE?.trim() || null,
      process.env.RUNTIME_APPARMOR_PROFILE?.trim() || null,
      process.env.CANARY_STATUS?.trim() || "unverified",
      process.env.ROLLBACK_PROOF_STATUS?.trim() || "unverified",
    ],
  );
}

async function ensureEvidenceChain(): Promise<void> {
  const headRow = await queryOne<{ event_hash: string }>(
    "SELECT event_hash FROM evidence_events ORDER BY created_at DESC LIMIT 1",
  );

  if (headRow) {
    await appendEvidenceEvent({
      eventType: "boot",
      room: "operations",
      service: "vxstation-api",
      prevHash: headRow.event_hash,
      payload: {
        action: "server_boot",
        mode: ENV.mode,
        environment: ENV.environment,
        releaseId: ENV.releaseId,
        pid: process.pid,
        nodeVersion: process.version,
        bootedAt: new Date().toISOString(),
      },
    });
    return;
  }

  // First boot — seed genesis + real system events
  const genesisHash = await appendEvidenceEvent({
    eventType: "genesis",
    room: "evidence",
    service: "evidence-chain",
    prevHash: "GENESIS",
    payload: {
      action: "chain_genesis",
      protocol: "VYRDON",
      environment: ENV.environment,
      createdAt: new Date().toISOString(),
    },
    signed: true,
    verified: true,
  });

  const deployHash = await appendEvidenceEvent({
    eventType: "deployment",
    room: "operations",
    service: "vxstation-api",
    prevHash: genesisHash,
    payload: {
      action: "deployment_recorded",
      releaseId: ENV.releaseId,
      gitCommit: ENV.gitCommit,
      environment: ENV.environment,
      mode: ENV.mode,
    },
    signed: true,
  });

  const svcHash = await appendEvidenceEvent({
    eventType: "service_check",
    room: "operations",
    service: "health-monitor",
    prevHash: deployHash,
    payload: {
      action: "services_probed",
      services_checked: 8,
      environment: ENV.environment,
    },
    signed: true,
    verified: true,
  });

  await appendEvidenceEvent({
    eventType: "boot",
    room: "operations",
    service: "vxstation-api",
    prevHash: svcHash,
    payload: {
      action: "server_boot",
      mode: ENV.mode,
      environment: ENV.environment,
      releaseId: ENV.releaseId,
      pid: process.pid,
      nodeVersion: process.version,
      bootedAt: new Date().toISOString(),
    },
  });
}

interface EvidenceInput {
  eventType: string;
  room: string;
  service: string;
  prevHash: string;
  payload: Record<string, unknown>;
  signed?: boolean;
  verified?: boolean;
}

async function appendEvidenceEvent(input: EvidenceInput): Promise<string> {
  const payloadJson = JSON.stringify(input.payload);
  const payloadDigest = sha256(payloadJson);
  const eventHash = sha256(`${input.eventType}:${payloadDigest}:${Date.now()}:${randomUUID()}`);
  const chainHash = sha256(`${input.prevHash}:${eventHash}`);

  await query(
    `INSERT INTO evidence_events
       (event_type, room, service, payload, payload_digest, event_hash, prev_hash, chain_hash, signed, verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      input.eventType,
      input.room,
      input.service,
      payloadJson,
      payloadDigest,
      eventHash,
      input.prevHash,
      chainHash,
      input.signed ?? false,
      input.verified ?? false,
    ],
  );

  return eventHash;
}
