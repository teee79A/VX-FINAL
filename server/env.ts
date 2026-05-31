// server/env.ts
// Centralized environment configuration for VXSTATION.
// Enforces separation between local (KITTY desktop) and cloud (Droplet) modes.
// Single source of truth — every module imports from here.

import { fileURLToPath } from "node:url";
import path from "node:path";

// ── MODE ──────────────────────────────────────────────────────────────────

export type VxstationMode = "local" | "cloud";

export const MODE: VxstationMode =
  (process.env.VXSTATION_MODE === "cloud" ? "cloud" : "local") as VxstationMode;

export const IS_LOCAL = MODE === "local";
export const IS_CLOUD = MODE === "cloud";

export const ENVIRONMENT_LABEL = IS_CLOUD ? "droplet" : "desktop";

// ── NODE ENV ──────────────────────────────────────────────────────────────

export const NODE_ENV = process.env.NODE_ENV ?? (IS_CLOUD ? "production" : "development");

// ── PATHS ─────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const KITTY_ROOT = process.env.KITTY_ROOT ?? path.resolve(__dirname, "..");
export const VYRDX_ROOT = process.env.VYRDX_ROOT ?? "/opt/vyrdx";

// ── SERVER ────────────────────────────────────────────────────────────────

export const PORT = Number(process.env.VXSTATION_PORT ?? 7800);
export const HOST = process.env.VXSTATION_HOST ?? "0.0.0.0";

// ── DATABASE ──────────────────────────────────────────────────────────────
// Local mode: optional local DB (postgresql://...@localhost/vyrdon_local)
// Cloud mode: production DB (from deploy.env)
// NEVER let local mode connect to production DB.

export const DATABASE_URL = process.env.DATABASE_URL ?? undefined;

// ── EVIDENCE ──────────────────────────────────────────────────────────────

export const EVIDENCE_DIR = process.env.EVIDENCE_DIR ??
  (IS_CLOUD
    ? "/opt/vxstation/shared/evidence"
    : path.join(KITTY_ROOT, "data", "evidence"));

export const LOG_DIR = process.env.LOG_DIR ??
  (IS_CLOUD
    ? "/opt/vxstation/shared/logs"
    : path.join(KITTY_ROOT, "logs"));

// ── AUTHORITY ─────────────────────────────────────────────────────────────

export const AUTHORITY_BASE_URL = process.env.AUTHORITY_BASE_URL ?? "https://consolelab.vyrdon.com";
export const CF_ACCESS_CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID ?? undefined;
export const CF_ACCESS_CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET ?? undefined;

// ── MONITOR TARGETS ───────────────────────────────────────────────────────

export const DROPLET_URL = process.env.DROPLET_URL ?? "https://vyrdx.vyrdon.com";
export const ASUS_URL = process.env.ASUS_URL ?? AUTHORITY_BASE_URL;
export const MONITOR_POLL_MS = Number(process.env.MONITOR_POLL_MS ?? 15_000);

// ── BUILD / RELEASE ───────────────────────────────────────────────────────

export const BUILD_ID = process.env.BUILD_TIME ?? "dev";
export const RELEASE_ID = process.env.RELEASE_ID ??
  (IS_CLOUD ? `${BUILD_ID}-${process.env.GIT_COMMIT?.slice(0, 7) ?? "unknown"}` : "local-dev");
export const GIT_COMMIT = process.env.GIT_COMMIT ?? "unknown";
export const GIT_BRANCH = process.env.GIT_BRANCH ?? "unknown";

// ── REDIS ─────────────────────────────────────────────────────────────────

export const REDIS_URL = process.env.REDIS_URL ?? undefined;

// ── PHASE-2 BACKEND SLICE BINDING ─────────────────────────────────────────

export const PHASE2_SLICE_ENABLED = process.env.VYRDX_PHASE2_SLICE_ENABLED !== "false";
export const PHASE2_API_AUTH_TOKEN =
  process.env.PHASE2_API_AUTH_TOKEN ??
  process.env.API_AUTH_TOKEN ??
  "";
export const PHASE2_WORKSPACE_ID = process.env.PHASE2_WORKSPACE_ID ?? "ws_demo";
export const PHASE2_COMMERCIAL_API_URL = process.env.PHASE2_COMMERCIAL_API_URL ?? "http://127.0.0.1:28080";
export const PHASE2_EVIDENCE_API_URL = process.env.PHASE2_EVIDENCE_API_URL ?? "http://127.0.0.1:28083";
export const PHASE2_PAYMENT_WEBHOOK_URL = process.env.PHASE2_PAYMENT_WEBHOOK_URL ?? "http://127.0.0.1:28082";
export const PHASE2_RECEIPT_WORKER_STATUS_URL =
  process.env.PHASE2_RECEIPT_WORKER_STATUS_URL ?? "http://127.0.0.1:28110";
export const PHASE2_EVIDENCE_HASH_WORKER_STATUS_URL =
  process.env.PHASE2_EVIDENCE_HASH_WORKER_STATUS_URL ?? "http://127.0.0.1:28111";
export const PHASE2_EVIDENCE_MANIFEST_WORKER_STATUS_URL =
  process.env.PHASE2_EVIDENCE_MANIFEST_WORKER_STATUS_URL ?? "http://127.0.0.1:28112";
export const PHASE2_ATTESTATION_SIGNER_STATUS_URL =
  process.env.PHASE2_ATTESTATION_SIGNER_STATUS_URL ?? "http://127.0.0.1:28113";
export const PHASE2_SMTP_WORKER_STATUS_URL =
  process.env.PHASE2_SMTP_WORKER_STATUS_URL ?? "http://127.0.0.1:28114";

// ── FULL CONFIG OBJECT ────────────────────────────────────────────────────

export const ENV = {
  mode: MODE,
  isLocal: IS_LOCAL,
  isCloud: IS_CLOUD,
  environment: ENVIRONMENT_LABEL,
  nodeEnv: NODE_ENV,
  kittyRoot: KITTY_ROOT,
  vyrdxRoot: VYRDX_ROOT,
  port: PORT,
  host: HOST,
  databaseUrl: DATABASE_URL,
  evidenceDir: EVIDENCE_DIR,
  logDir: LOG_DIR,
  authorityBaseUrl: AUTHORITY_BASE_URL,
  dropletUrl: DROPLET_URL,
  asusUrl: ASUS_URL,
  monitorPollMs: MONITOR_POLL_MS,
  buildId: BUILD_ID,
  releaseId: RELEASE_ID,
  gitCommit: GIT_COMMIT,
  gitBranch: GIT_BRANCH,
  redisUrl: REDIS_URL,
  phase2SliceEnabled: PHASE2_SLICE_ENABLED,
  phase2ApiAuthToken: PHASE2_API_AUTH_TOKEN,
  phase2WorkspaceId: PHASE2_WORKSPACE_ID,
  phase2CommercialApiUrl: PHASE2_COMMERCIAL_API_URL,
  phase2EvidenceApiUrl: PHASE2_EVIDENCE_API_URL,
  phase2PaymentWebhookUrl: PHASE2_PAYMENT_WEBHOOK_URL,
  phase2ReceiptWorkerStatusUrl: PHASE2_RECEIPT_WORKER_STATUS_URL,
  phase2EvidenceHashWorkerStatusUrl: PHASE2_EVIDENCE_HASH_WORKER_STATUS_URL,
  phase2EvidenceManifestWorkerStatusUrl: PHASE2_EVIDENCE_MANIFEST_WORKER_STATUS_URL,
  phase2AttestationSignerStatusUrl: PHASE2_ATTESTATION_SIGNER_STATUS_URL,
  phase2SmtpWorkerStatusUrl: PHASE2_SMTP_WORKER_STATUS_URL,
} as const;
