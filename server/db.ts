/**
 * VYRDON Database Layer
 *
 * Postgres connection pool + schema migration for Commercial, Operations, and Evidence rooms.
 * Connection via DATABASE_URL env var. Pool is lazy-initialized on first query.
 */

import pg from "pg";
import { DB_RUNTIME_ENV } from "./db/env.js";

const { Pool } = pg;

// ── POOL ──────────────────────────────────────────────────────────────────

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    if (!DB_RUNTIME_ENV.databaseUrl) {
      throw new Error(DB_RUNTIME_ENV.configError ?? "DATABASE_URL not set — cannot connect to Postgres");
    }
    pool = new Pool({
      connectionString: DB_RUNTIME_ENV.databaseUrl,
      min: DB_RUNTIME_ENV.poolMin,
      max: DB_RUNTIME_ENV.poolMax,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: DB_RUNTIME_ENV.sslMode === "require" ? { rejectUnauthorized: true } : undefined,
    });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function dbHealthy(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

// ── SCHEMA MIGRATION ──────────────────────────────────────────────────────

const SCHEMA_SQL = `
-- ═══ COMMERCIAL ═══

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','paused','blocked','churned')),
  plan TEXT NOT NULL CHECK (plan IN ('core','execution','verified','enterprise')),
  billing_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  monthly_price_cents BIGINT NOT NULL,
  execution_limit INTEGER NOT NULL DEFAULT 0,
  environments_limit INTEGER NOT NULL DEFAULT 1,
  starts_at TIMESTAMPTZ NOT NULL,
  renews_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('active','paused','terminated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  contract_id UUID REFERENCES contracts(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  subtotal_cents BIGINT NOT NULL,
  credits_cents BIGINT NOT NULL DEFAULT 0,
  total_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('draft','issued','paid','overdue','void')),
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  evidence_hash TEXT NOT NULL,
  execution_summary JSONB NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  state TEXT NOT NULL CHECK (state IN ('executed','partial','failed')),
  summary JSONB NOT NULL,
  evidence_hash TEXT NOT NULL,
  stamped_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ OPERATIONS ═══

CREATE TABLE IF NOT EXISTS service_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'prod',
  status TEXT NOT NULL CHECK (status IN ('healthy','degraded','down')),
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL,
  release_id TEXT NOT NULL,
  git_commit TEXT NOT NULL,
  build_time TIMESTAMPTZ,
  operator TEXT,
  status TEXT NOT NULL CHECK (status IN ('started','succeeded','failed','rolled_back')),
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL CHECK (status IN ('open','mitigating','resolved')),
  summary TEXT NOT NULL,
  owner TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','retrying','dead')),
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ EVIDENCE ═══

CREATE TABLE IF NOT EXISTS evidence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  room TEXT NOT NULL,
  service TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  execution_id UUID,
  receipt_id UUID REFERENCES receipts(id),
  stamp_id UUID REFERENCES stamps(id),
  payload JSONB NOT NULL,
  payload_digest TEXT NOT NULL,
  event_hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  chain_hash TEXT NOT NULL,
  signed BOOLEAN NOT NULL DEFAULT false,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  scope JSONB NOT NULL,
  export_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ CALENDAR ═══

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('commercial','operations','policy','evidence','executive')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','due','overdue','completed','blocked')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  owner TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','stripe','deployment','policy-engine','evidence-engine','system')),
  related_entity_id UUID,
  action_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ VYRDX PRODUCT SCHEMA v2 ═══

-- Migrate from v1 if old schema detected (pre-launch, no customer data)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seals' AND column_name = 'action'
  ) THEN
    DROP TABLE IF EXISTS commercial_actions CASCADE;
    DROP TABLE IF EXISTS billing_events CASCADE;
    DROP TABLE IF EXISTS workspace_usage_periods CASCADE;
    DROP TABLE IF EXISTS seal_metadata CASCADE;
    DROP TABLE IF EXISTS seal_events CASCADE;
    DROP TABLE IF EXISTS proofs CASCADE;
    DROP TABLE IF EXISTS seals CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS workspaces CASCADE;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','solo','business','enterprise')),
  billing_customer_id TEXT,
  billing_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);

CREATE TABLE IF NOT EXISTS seals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  payload_json JSONB NOT NULL,
  payload_sha256 TEXT NOT NULL,
  previous_seal_id TEXT REFERENCES seals(id),
  previous_hash TEXT,
  sequence_no BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sealed' CHECK (status IN ('sealed','failed','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS proofs (
  id TEXT PRIMARY KEY,
  seal_id TEXT NOT NULL UNIQUE REFERENCES seals(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  public_slug TEXT NOT NULL UNIQUE,
  proof_url TEXT NOT NULL UNIQUE,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_usage_periods (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  included_seals INTEGER NOT NULL,
  used_seals INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS seal_metadata (
  id BIGSERIAL PRIMARY KEY,
  seal_id TEXT NOT NULL REFERENCES seals(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value_text TEXT,
  value_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seal_events (
  id TEXT PRIMARY KEY,
  seal_id TEXT NOT NULL REFERENCES seals(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'subscription_started', 'subscription_upgraded', 'subscription_downgraded',
      'invoice_issued', 'invoice_paid', 'invoice_failed', 'invoice_overdue',
      'subscription_canceled', 'payment_request', 'payment_confirmed'
    )
  ),
  amount_cents BIGINT,
  currency TEXT DEFAULT 'usd',
  customer_name TEXT,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commercial_actions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  related_customer TEXT,
  related_invoice_id TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','blocked','done')),
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ ROOM CONTRACT BACKBONE (FIXED) ═══

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_status') THEN
    CREATE TYPE room_status AS ENUM ('green', 'amber', 'red', 'sealed');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS room_registry (
  room_key TEXT PRIMARY KEY,
  room_name TEXT NOT NULL,
  record_class TEXT NOT NULL CHECK (record_class IN ('public', 'private')),
  owner TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_summary (
  room_key TEXT NOT NULL REFERENCES room_registry(room_key) ON DELETE CASCADE,
  status_color room_status NOT NULL,
  reason_code TEXT,
  reason_text TEXT,
  delta_summary TEXT,
  updated_at_utc TIMESTAMPTZ NOT NULL,
  owner TEXT NOT NULL,
  evidence_ref TEXT,
  next_action TEXT,
  next_update_eta TIMESTAMPTZ,
  PRIMARY KEY (room_key)
);

CREATE TABLE IF NOT EXISTS room_status_reasons (
  id BIGSERIAL PRIMARY KEY,
  room_key TEXT NOT NULL REFERENCES room_registry(room_key) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  reason_text TEXT NOT NULL,
  evidence_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS room_change_events (
  id BIGSERIAL PRIMARY KEY,
  room_key TEXT NOT NULL REFERENCES room_registry(room_key) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_payload JSONB NOT NULL,
  evidence_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS room_actions (
  id BIGSERIAL PRIMARY KEY,
  room_key TEXT NOT NULL REFERENCES room_registry(room_key) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  action_label TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  requires_policy BOOLEAN NOT NULL DEFAULT true,
  requires_evidence BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_key, action_key)
);

INSERT INTO room_registry (room_key, room_name, record_class, owner, is_enabled)
VALUES
  ('camp', 'Camp', 'public', 'authority', true),
  ('commercial', 'Commercial', 'private', 'commercial-service', true),
  ('evidence', 'Evidence', 'private', 'evidence-service', true),
  ('market', 'Market', 'public', 'market-service', true),
  ('reports_plans', 'Reports / Plans', 'private', 'reports-plans-service', true),
  ('system', 'System', 'private', 'system-service', true),
  ('ops', 'Ops', 'private', 'ops-service', true)
ON CONFLICT (room_key) DO UPDATE
SET
  room_name = EXCLUDED.room_name,
  record_class = EXCLUDED.record_class,
  owner = EXCLUDED.owner,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = now();

-- 4-table backbone per room (room-local tables; required by room contract)
DO $$
DECLARE room_name TEXT;
BEGIN
  FOREACH room_name IN ARRAY ARRAY['camp','commercial','evidence','market','reports_plans','system','ops']
  LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I_summary (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         status TEXT NOT NULL CHECK (status IN (''green'',''yellow'',''red'')),
         summary_json JSONB NOT NULL DEFAULT ''{}''::jsonb,
         reason_count INTEGER NOT NULL DEFAULT 0,
         evidence_ref TEXT,
         record_class TEXT NOT NULL CHECK (record_class IN (''Public'',''Private'')),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )',
      room_name
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I_status_reasons (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         summary_id UUID,
         status TEXT NOT NULL CHECK (status IN (''green'',''yellow'',''red'')),
         reason_code TEXT NOT NULL,
         reason_text TEXT NOT NULL,
         evidence_ref TEXT NOT NULL,
         next_action TEXT NOT NULL,
         next_update_eta TIMESTAMPTZ NOT NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )',
      room_name
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I_change_events (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         event_type TEXT NOT NULL,
         event_payload JSONB NOT NULL DEFAULT ''{}''::jsonb,
         evidence_ref TEXT,
         actor TEXT,
         happened_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )',
      room_name
    );

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I_actions (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         action_name TEXT NOT NULL,
         action_payload JSONB NOT NULL DEFAULT ''{}''::jsonb,
         requested_by TEXT NOT NULL DEFAULT ''system'',
         status TEXT NOT NULL DEFAULT ''open'' CHECK (status IN (''open'',''running'',''blocked'',''done'',''rejected'')),
         evidence_ref TEXT,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )',
      room_name
    );
  END LOOP;
END$$;

-- Camp tables
CREATE TABLE IF NOT EXISTS camp_identity (
  id BIGSERIAL PRIMARY KEY,
  protocol_name TEXT NOT NULL,
  system_name TEXT NOT NULL,
  execution_model TEXT NOT NULL,
  seal_policy TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS camp_licenses (
  id BIGSERIAL PRIMARY KEY,
  license_name TEXT NOT NULL,
  license_scope TEXT NOT NULL,
  license_status TEXT NOT NULL,
  display_order INT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS camp_readme (
  id BIGSERIAL PRIMARY KEY,
  paragraph TEXT NOT NULL,
  code_injection JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS camp_contacts (
  id BIGSERIAL PRIMARY KEY,
  contact_role TEXT NOT NULL,
  email TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contact_role)
);

CREATE TABLE IF NOT EXISTS camp_documents (
  id BIGSERIAL PRIMARY KEY,
  doc_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS camp_coordination_notes (
  id BIGSERIAL PRIMARY KEY,
  note_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Commercial tables
CREATE TABLE IF NOT EXISTS commercial_billing_summary (
  id BIGSERIAL PRIMARY KEY,
  billing_source TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual_verified',
  component_paypal BOOLEAN NOT NULL DEFAULT false,
  component_bank_transfer BOOLEAN NOT NULL DEFAULT false,
  component_btc_wallet BOOLEAN NOT NULL DEFAULT false,
  component_eth_wallet BOOLEAN NOT NULL DEFAULT false,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verification_method TEXT,
  last_verified_at TIMESTAMPTZ,
  verified_by TEXT,
  evidence_ref TEXT,
  bank_account_label TEXT,
  bank_routing_last4 TEXT,
  bank_account_last4 TEXT,
  invoice_count_open INT NOT NULL DEFAULT 0,
  invoice_count_paid INT NOT NULL DEFAULT 0,
  invoice_count_failed INT NOT NULL DEFAULT 0,
  renewals_due_30d INT NOT NULL DEFAULT 0,
  last_billing_sync_utc TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE commercial_billing_summary
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual_verified',
  ADD COLUMN IF NOT EXISTS component_paypal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS component_bank_transfer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS component_btc_wallet BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS component_eth_wallet BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_connected BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_method TEXT,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by TEXT,
  ADD COLUMN IF NOT EXISTS evidence_ref TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_label TEXT,
  ADD COLUMN IF NOT EXISTS bank_routing_last4 TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_last4 TEXT;

CREATE TABLE IF NOT EXISTS commercial_entitlements (
  id BIGSERIAL PRIMARY KEY,
  license_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  certificate_entitled BOOLEAN NOT NULL DEFAULT false,
  evidence_entitled BOOLEAN NOT NULL DEFAULT false,
  market_tier TEXT,
  monthly_cap INT,
  status TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (license_id)
);

CREATE TABLE IF NOT EXISTS commercial_certificates (
  id BIGSERIAL PRIMARY KEY,
  certificate_id TEXT NOT NULL UNIQUE,
  license_id TEXT NOT NULL,
  issuer TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence_ref TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  tx_hash TEXT,
  issued_at_utc TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Evidence tables
CREATE TABLE IF NOT EXISTS evidence_ledger (
  id BIGSERIAL PRIMARY KEY,
  evidence_ref TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  prev_hash TEXT,
  chain_hash TEXT NOT NULL,
  tx_hash TEXT,
  block_number BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_queue (
  id BIGSERIAL PRIMARY KEY,
  queue_key TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ VYRDX MARKET TELEMETRY (Phase 2) ═══

CREATE TABLE IF NOT EXISTS telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  session_id TEXT NOT NULL,
  path TEXT,
  referrer TEXT,
  user_agent TEXT,
  detail TEXT,
  decision_status TEXT,
  eligible_to_proceed BOOLEAN,
  missing_fields TEXT[],
  top_missing_fields TEXT[],
  campaign_id TEXT,
  asset_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_type ON telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_session ON telemetry_events(session_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_created ON telemetry_events(created_at DESC);

CREATE TABLE IF NOT EXISTS telemetry_rollups (
  id BIGSERIAL PRIMARY KEY,
  window_minutes INT NOT NULL,
  visitors_count INT NOT NULL DEFAULT 0,
  page_views_count INT NOT NULL DEFAULT 0,
  meter_clicks_count INT NOT NULL DEFAULT 0,
  menu_clicks_count INT NOT NULL DEFAULT 0,
  gate_evaluations_count INT NOT NULL DEFAULT 0,
  gate_green_count INT NOT NULL DEFAULT 0,
  gate_yellow_count INT NOT NULL DEFAULT 0,
  gate_red_count INT NOT NULL DEFAULT 0,
  top_missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  rollup_start TIMESTAMPTZ NOT NULL,
  rollup_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(window_minutes, rollup_start)
);

-- ═══ VYRDX BOT JOB RUNNER (Phase 3) ═══

CREATE TABLE IF NOT EXISTS flyer_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','queued','running','succeeded','failed','cancelled')),
  targets_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  dry_run BOOLEAN NOT NULL DEFAULT true,
  throttle_seconds INT NOT NULL DEFAULT 10,
  dedupe_key TEXT,
  opt_out_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  flyer_sent_count INT NOT NULL DEFAULT 0,
  reply_received_count INT NOT NULL DEFAULT 0,
  booked_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  run_started_at TIMESTAMPTZ,
  run_finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flyer_jobs_status ON flyer_jobs(status);
CREATE INDEX IF NOT EXISTS idx_flyer_jobs_created ON flyer_jobs(created_at DESC);

CREATE TABLE IF NOT EXISTS flyer_send_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES flyer_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('flyer_sent','reply_received','booked','error')),
  target_email TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flyer_send_events_job ON flyer_send_events(job_id);

CREATE TABLE IF NOT EXISTS evidence_key_events (
  id BIGSERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  actor TEXT NOT NULL,
  evidence_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Market tables
CREATE TABLE IF NOT EXISTS market_sources (
  id BIGSERIAL PRIMARY KEY,
  source_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  base_url TEXT,
  last_sync_utc TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_targets (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  source_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE market_targets
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS market_snapshots (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL REFERENCES market_targets(symbol) ON DELETE CASCADE,
  price NUMERIC(30,10) NOT NULL,
  change_24h NUMERIC(12,4),
  change_7d NUMERIC(12,4),
  volatility_class TEXT,
  signal_state TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_analysis (
  id BIGSERIAL PRIMARY KEY,
  regime TEXT NOT NULL,
  trend_summary TEXT NOT NULL,
  bullish_count INT NOT NULL,
  bearish_count INT NOT NULL,
  anomaly_count INT NOT NULL,
  review_timestamp TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_intel_rows (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL REFERENCES market_targets(symbol) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  headline TEXT NOT NULL,
  url TEXT,
  signal_type TEXT NOT NULL,
  sentiment TEXT NOT NULL,
  impact_score INT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS market_competitors (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL REFERENCES market_targets(symbol) ON DELETE CASCADE,
  competitor_symbol TEXT NOT NULL REFERENCES market_targets(symbol) ON DELETE CASCADE,
  relation TEXT NOT NULL DEFAULT 'competitor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(symbol, competitor_symbol)
);

-- System and boundary tables
CREATE TABLE IF NOT EXISTS system_attestation (
  id BIGSERIAL PRIMARY KEY,
  component_name TEXT NOT NULL,
  status TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_boundary_state (
  id BIGSERIAL PRIMARY KEY,
  boundary_owner TEXT NOT NULL,
  boundary_admin TEXT,
  timelock_address TEXT,
  guardian_address TEXT,
  owner_is_eoa BOOLEAN NOT NULL,
  status TEXT NOT NULL,
  evidence_ref TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_runtime_isolation (
  id BIGSERIAL PRIMARY KEY,
  service_name TEXT NOT NULL UNIQUE,
  rootfs_read_only BOOLEAN NOT NULL,
  dropped_caps BOOLEAN NOT NULL,
  explicit_mounts_only BOOLEAN NOT NULL,
  seccomp_profile TEXT,
  apparmor_profile TEXT,
  canary_status TEXT,
  rollback_proof_status TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ INDEXES ═══

CREATE INDEX IF NOT EXISTS idx_contracts_customer ON contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_receipts_customer ON receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_receipts_invoice ON receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_stamps_customer ON stamps(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_status_name ON service_status(service_name);
CREATE INDEX IF NOT EXISTS idx_deployments_env ON deployments(environment);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_job_runs_customer ON job_runs(customer_id);
CREATE INDEX IF NOT EXISTS idx_job_runs_status ON job_runs(status);
CREATE INDEX IF NOT EXISTS idx_evidence_events_customer ON evidence_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_evidence_events_room ON evidence_events(room);
CREATE INDEX IF NOT EXISTS idx_evidence_events_type ON evidence_events(event_type);
CREATE INDEX IF NOT EXISTS idx_evidence_events_receipt ON evidence_events(receipt_id);
CREATE INDEX IF NOT EXISTS idx_evidence_events_stamp ON evidence_events(stamp_id);
CREATE INDEX IF NOT EXISTS idx_evidence_exports_customer ON evidence_exports(customer_id);
CREATE INDEX IF NOT EXISTS idx_calendar_category ON calendar_events(category);
CREATE INDEX IF NOT EXISTS idx_calendar_status ON calendar_events(status);
CREATE INDEX IF NOT EXISTS idx_calendar_starts_at ON calendar_events(starts_at);

-- ═══ VYRDX PRODUCT INDEXES ═══

CREATE INDEX IF NOT EXISTS idx_users_workspace ON users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_seals_workspace ON seals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_seals_sequence ON seals(workspace_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_seals_created ON seals(created_at);
CREATE INDEX IF NOT EXISTS idx_seals_hash ON seals(payload_sha256);
CREATE INDEX IF NOT EXISTS idx_proofs_seal ON proofs(seal_id);
CREATE INDEX IF NOT EXISTS idx_proofs_slug ON proofs(public_slug);
CREATE INDEX IF NOT EXISTS idx_usage_periods_workspace ON workspace_usage_periods(workspace_id);
CREATE INDEX IF NOT EXISTS idx_seal_metadata_seal ON seal_metadata(seal_id);
CREATE INDEX IF NOT EXISTS idx_seal_metadata_key ON seal_metadata(key);
CREATE INDEX IF NOT EXISTS idx_seal_events_workspace ON seal_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_seal_events_seal ON seal_events(seal_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_workspace ON billing_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_type ON billing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_events_created ON billing_events(created_at);
CREATE INDEX IF NOT EXISTS idx_commercial_actions_workspace ON commercial_actions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_commercial_actions_status ON commercial_actions(status);
CREATE INDEX IF NOT EXISTS idx_room_status_reasons_room ON room_status_reasons(room_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_change_events_room ON room_change_events(room_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_actions_room ON room_actions(room_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_ledger_ref ON evidence_ledger(evidence_ref);
CREATE INDEX IF NOT EXISTS idx_evidence_ledger_created ON evidence_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_camp_documents_key ON camp_documents(doc_key);
CREATE INDEX IF NOT EXISTS idx_camp_coordination_status ON camp_coordination_notes(status, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_targets_active ON market_targets(is_active, symbol);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_symbol ON market_snapshots(symbol, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_intel_symbol ON market_intel_rows(symbol, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_intel_captured_at ON market_intel_rows(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_competitors_symbol ON market_competitors(symbol);
CREATE INDEX IF NOT EXISTS idx_market_competitors_competitor ON market_competitors(competitor_symbol);
CREATE INDEX IF NOT EXISTS idx_system_attestation_component ON system_attestation(component_name, updated_at DESC);
`;

export async function migrateSchema(): Promise<void> {
  await getPool().query(SCHEMA_SQL);
}

export const REQUIRED_SCHEMA_VERSION = 20260421;

export async function ensureSchemaVersion(version: number = REQUIRED_SCHEMA_VERSION): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await query(
    `INSERT INTO schema_version (id, version, updated_at)
     VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE
       SET version = EXCLUDED.version,
           updated_at = now()`,
    [version],
  );
}

export async function getSchemaVersion(): Promise<number | null> {
  try {
    const row = await queryOne<{ version: number | string }>(
      "SELECT version FROM schema_version WHERE id = 1",
    );
    if (!row) return null;
    const parsed = Number(row.version);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
