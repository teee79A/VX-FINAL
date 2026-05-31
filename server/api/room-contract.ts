/**
 * Room Contract API
 *
 * Canonical room backbone:
 *   1. *_summary
 *   2. *_status_reasons
 *   3. *_change_events
 *   4. *_actions
 *
 * Freeze-safe scope:
 * - read contract state
 * - enforce allowed action list per room
 * - expose stop-condition checks
 */

import type { FastifyInstance } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { PoolClient } from "pg";
import { getPool, query, queryOne } from "../db.js";
import { PAYMENT_CONFIG } from "../config/payments.js";
import { ENV } from "../env.js";
import { validateRoomSummary } from "../../packages/room-contracts/src/index.js";
import { runtimeModeService } from "../services/runtimeModeService.js";
import { appendEvidenceLedgerTx } from "../lib/evidence-ledger.js";
import { isZeroTrustServiceTokenConfigured } from "../security/zero-trust.js";

type RoomStatus = "green" | "yellow" | "amber" | "red";
type RoomKey = "camp" | "commercial" | "evidence" | "market" | "reports_plans" | "system" | "ops";
type ActorRole = "authority" | "operator" | "system";
type StopConditionScope = "read" | "write";
type BillingSourceType =
  | "paypal"
  | "bank_transfer"
  | "btc_wallet"
  | "eth_wallet"
  | "hybrid"
  | "manual_verified";

interface StopCondition {
  code: string;
  scope: StopConditionScope;
  source?: string;
}

interface RoomSummaryRow {
  id: string;
  status: RoomStatus;
  summary_json: Record<string, unknown>;
  reason_count: number;
  evidence_ref: string | null;
  record_class: "Public" | "Private";
  updated_at: string;
  created_at: string;
}

interface RoomReasonRow {
  id: string;
  summary_id: string | null;
  status: RoomStatus;
  reason_code: string;
  reason_text: string;
  evidence_ref: string;
  next_action: string;
  next_update_eta: string;
  created_at: string;
}

interface RoomEventRow {
  id: string;
  event_type: string;
  event_payload: Record<string, unknown>;
  evidence_ref: string | null;
  actor: string | null;
  happened_at: string;
}

interface RoomActionRow {
  id: string;
  action_name: string;
  action_payload: Record<string, unknown>;
  requested_by: string;
  status: "open" | "running" | "blocked" | "done" | "rejected";
  evidence_ref: string | null;
  created_at: string;
  updated_at: string;
}

interface StopConditionSplit {
  hasReadBlockingConditions: boolean;
  hasWriteBlockingConditions: boolean;
  conditions: StopCondition[];
}

interface RoomConfig {
  aliases: readonly string[];
  title: string;
  recordClass: "Public" | "Private";
  allowedActions: readonly string[];
}

const ROOM_CONFIG: Record<RoomKey, RoomConfig> = {
  camp: {
    aliases: ["camps", "about"],
    title: "Camp",
    recordClass: "Public",
    allowedActions: ["refresh_identity", "refresh_licenses", "refresh_readme", "refresh_contact"],
  },
  commercial: {
    aliases: ["billing", "revenue"],
    title: "Commercial",
    recordClass: "Private",
    allowedActions: [
      "sync_billing",
      "refresh_entitlements",
      "issue_certificate",
      "revoke_certificate",
      "export_commercial_record",
    ],
  },
  evidence: {
    aliases: ["audit", "proof"],
    title: "Evidence",
    recordClass: "Private",
    allowedActions: [
      "reverify_proof",
      "export_evidence_bundle",
      "view_tx_mapping",
      "rotate_signing_key",
      "revoke_signing_key",
    ],
  },
  market: {
    aliases: ["signals"],
    title: "Market",
    recordClass: "Public",
    allowedActions: ["refresh_market_sources", "refresh_targets", "export_market_snapshot"],
  },
  reports_plans: {
    aliases: ["reports", "plans", "reports-plans"],
    title: "Reports / Plans",
    recordClass: "Private",
    allowedActions: ["generate_report", "update_execution_plan", "set_next_review_eta", "export_plan_snapshot"],
  },
  system: {
    aliases: ["policy", "risk"],
    title: "System",
    recordClass: "Private",
    allowedActions: ["refresh_trust_closure", "refresh_attestation", "refresh_boundary_state"],
  },
  ops: {
    aliases: ["operations", "operation"],
    title: "Ops",
    recordClass: "Private",
    allowedActions: [
      "baseline_capture",
      "health_refresh",
      "canary_deploy",
      "rollback",
      "evidence_export",
      "seal_review",
    ],
  },
};

const ROOM_ROLE_POLICY: Record<RoomKey, readonly ActorRole[]> = {
  camp: ["authority", "system"],
  commercial: ["operator", "authority", "system"],
  evidence: ["operator", "authority", "system"],
  market: ["operator", "authority", "system"],
  reports_plans: ["operator", "authority", "system"],
  system: ["authority", "system"],
  ops: ["operator", "authority", "system"],
};

const PROOF_BOUND_ROOMS = new Set<RoomKey>([
  "commercial",
  "evidence",
  "market",
  "reports_plans",
  "system",
  "ops",
]);

const ROOM_OWNER: Record<RoomKey, string> = {
  camp: "camp-service",
  commercial: "commercial-service",
  evidence: "evidence-service",
  market: "market-service",
  reports_plans: "reports-plans-service",
  system: "system-service",
  ops: "ops-service",
};

interface RoomSummaryPatch {
  status: RoomStatus;
  reasonCode: string | null;
  reasonText: string | null;
  deltaSummary: string;
  nextAction: string | null;
}

interface RoomActionMutationResult {
  domainWrites: string[];
  summaryPatch?: RoomSummaryPatch;
}

interface BillingComponents {
  paypal: boolean;
  bankTransfer: boolean;
  btcWallet: boolean;
  ethWallet: boolean;
}

interface BillingVerificationState {
  sourceType: BillingSourceType;
  components: BillingComponents;
  isConnected: boolean;
  isVerified: boolean;
  verificationMethod: string | null;
  lastVerifiedAt: string | null;
  verifiedBy: string | null;
  evidenceRef: string | null;
  bankAccountLabel: string | null;
  bankRoutingLast4: string | null;
  bankAccountLast4: string | null;
}

interface RoomActionMutationContext {
  requestedBy: string;
  evidenceRef: string;
}

const BILLING_SOURCE_TYPES: ReadonlySet<BillingSourceType> = new Set([
  "paypal",
  "bank_transfer",
  "btc_wallet",
  "eth_wallet",
  "hybrid",
  "manual_verified",
]);

function parseBooleanLike(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function parseIsoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function extractLast4(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replaceAll(/[^a-zA-Z0-9]/g, "");
  if (!normalized) return null;
  return normalized.slice(-4);
}

function maskBankLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 2) return `${trimmed[0] ?? "*"}*`;
  if (trimmed.length <= 4) return `${trimmed[0]}**${trimmed.at(-1) ?? ""}`;
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
}

function normalizeBillingSourceType(
  requested: string | null | undefined,
  components: BillingComponents,
): BillingSourceType {
  const normalized = requested?.trim().toLowerCase();
  if (normalized && BILLING_SOURCE_TYPES.has(normalized as BillingSourceType)) {
    return normalized as BillingSourceType;
  }

  const componentCount =
    Number(components.paypal) +
    Number(components.bankTransfer) +
    Number(components.btcWallet) +
    Number(components.ethWallet);
  if (componentCount > 1) return "hybrid";
  if (components.paypal) return "paypal";
  if (components.bankTransfer) return "bank_transfer";
  if (components.btcWallet) return "btc_wallet";
  if (components.ethWallet) return "eth_wallet";
  return "manual_verified";
}

function resolveBillingComponents(payload: Record<string, unknown>): BillingComponents {
  const approvedComponents = Array.isArray(payload["approved_components"])
    ? payload["approved_components"]
    : Array.isArray(payload["approvedComponents"])
      ? payload["approvedComponents"]
      : [];
  const approvedSet = new Set(
    approvedComponents
      .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
      .filter((entry) => entry.length > 0),
  );
  const hasApprovedList = approvedSet.size > 0;

  const envComponents: BillingComponents = {
    paypal: Boolean(PAYMENT_CONFIG.paypalMeUrl || PAYMENT_CONFIG.paypalReceiverEmail),
    bankTransfer: Boolean(PAYMENT_CONFIG.bank.accountNumber || PAYMENT_CONFIG.bank.routingNumber),
    btcWallet: Boolean(PAYMENT_CONFIG.btc.address),
    ethWallet: Boolean(PAYMENT_CONFIG.eth.address),
  };

  const resolveComponent = (
    explicit: boolean | undefined,
    aliases: string[],
    envDefault: boolean,
  ): boolean => {
    if (explicit !== undefined) return explicit;
    if (hasApprovedList) return aliases.some((alias) => approvedSet.has(alias));
    return envDefault;
  };

  const explicitPaypal =
    parseBooleanLike(payload["component_paypal"]) ??
    parseBooleanLike(payload["componentPaypal"]) ??
    parseBooleanLike(payload["paypal"]);
  const explicitBank =
    parseBooleanLike(payload["component_bank_transfer"]) ??
    parseBooleanLike(payload["componentBankTransfer"]) ??
    parseBooleanLike(payload["bank_transfer"]) ??
    parseBooleanLike(payload["bankTransfer"]);
  const explicitBtc =
    parseBooleanLike(payload["component_btc_wallet"]) ??
    parseBooleanLike(payload["componentBtcWallet"]) ??
    parseBooleanLike(payload["btc_wallet"]) ??
    parseBooleanLike(payload["btcWallet"]);
  const explicitEth =
    parseBooleanLike(payload["component_eth_wallet"]) ??
    parseBooleanLike(payload["componentEthWallet"]) ??
    parseBooleanLike(payload["eth_wallet"]) ??
    parseBooleanLike(payload["ethWallet"]);

  return {
    paypal: resolveComponent(explicitPaypal, ["paypal"], envComponents.paypal),
    bankTransfer: resolveComponent(explicitBank, ["bank_transfer", "bank"], envComponents.bankTransfer),
    btcWallet: resolveComponent(explicitBtc, ["btc_wallet", "btc"], envComponents.btcWallet),
    ethWallet: resolveComponent(explicitEth, ["eth_wallet", "eth"], envComponents.ethWallet),
  };
}

function buildBillingVerificationState(
  payload: Record<string, unknown>,
  requestedBy: string,
  evidenceRef: string,
): BillingVerificationState {
  const components = resolveBillingComponents(payload);
  const hasApprovedComponent =
    components.paypal || components.bankTransfer || components.btcWallet || components.ethWallet;

  const requestedSourceType =
    getPayloadString(payload, "source_type") ??
    getPayloadString(payload, "sourceType");
  const sourceType = normalizeBillingSourceType(requestedSourceType, components);

  const isConnected = getPayloadBoolean(payload, "is_connected")
    ?? getPayloadBoolean(payload, "isConnected")
    ?? hasApprovedComponent;

  const isVerified = getPayloadBoolean(payload, "is_verified")
    ?? getPayloadBoolean(payload, "isVerified")
    ?? isConnected;

  const verificationMethod = isVerified
    ? (
        getPayloadString(payload, "verification_method")
        ?? getPayloadString(payload, "verificationMethod")
        ?? "manual_attested"
      ).toLowerCase()
    : null;

  const lastVerifiedAt = isVerified
    ? (
        parseIsoOrNull(getPayloadString(payload, "last_verified_at"))
        ?? parseIsoOrNull(getPayloadString(payload, "lastVerifiedAt"))
        ?? new Date().toISOString()
      )
    : null;

  const verifiedBy = isVerified
    ? (
        getPayloadString(payload, "verified_by")
        ?? getPayloadString(payload, "verifiedBy")
        ?? requestedBy
      )
    : null;

  const bankLabelRaw =
    getPayloadString(payload, "bank_account_label")
    ?? getPayloadString(payload, "bankAccountLabel")
    ?? getPayloadString(payload, "bank_account_name")
    ?? getPayloadString(payload, "bankAccountName")
    ?? PAYMENT_CONFIG.bank.accountName
    ?? null;

  const bankRoutingRaw =
    getPayloadString(payload, "bank_routing_last4")
    ?? getPayloadString(payload, "bankRoutingLast4")
    ?? getPayloadString(payload, "bank_routing_number")
    ?? getPayloadString(payload, "bankRoutingNumber")
    ?? getPayloadString(payload, "routingNumber")
    ?? PAYMENT_CONFIG.bank.routingNumber
    ?? null;

  const bankAccountRaw =
    getPayloadString(payload, "bank_account_last4")
    ?? getPayloadString(payload, "bankAccountLast4")
    ?? getPayloadString(payload, "bank_account_number")
    ?? getPayloadString(payload, "bankAccountNumber")
    ?? getPayloadString(payload, "accountNumber")
    ?? PAYMENT_CONFIG.bank.accountNumber
    ?? null;

  return {
    sourceType,
    components,
    isConnected,
    isVerified,
    verificationMethod,
    lastVerifiedAt,
    verifiedBy,
    evidenceRef,
    bankAccountLabel: maskBankLabel(bankLabelRaw),
    bankRoutingLast4: extractLast4(bankRoutingRaw),
    bankAccountLast4: extractLast4(bankAccountRaw),
  };
}

function isBillingSourceLaunchVerified(
  state: Pick<
    BillingVerificationState,
    "sourceType" | "components" | "isConnected" | "isVerified" | "verificationMethod" | "lastVerifiedAt" | "verifiedBy" | "evidenceRef"
  >,
): boolean {
  const sourceTypeAllowed = state.sourceType === "hybrid" || state.sourceType === "manual_verified";
  const hasApprovedComponent =
    state.components.paypal ||
    state.components.bankTransfer ||
    state.components.btcWallet ||
    state.components.ethWallet;
  const verificationMethodOk = (state.verificationMethod ?? "").trim().toLowerCase() === "manual_attested";
  const verifiedAtMs = Date.parse(state.lastVerifiedAt ?? "");
  const verifiedAtOk = Number.isFinite(verifiedAtMs);
  const verifiedByOk = Boolean(state.verifiedBy?.trim());
  const evidenceOk = Boolean(state.evidenceRef?.trim());

  return (
    sourceTypeAllowed &&
    hasApprovedComponent &&
    state.isConnected &&
    state.isVerified &&
    verificationMethodOk &&
    verifiedAtOk &&
    verifiedByOk &&
    evidenceOk
  );
}

function sanitizeActionPayloadForAudit(
  room: RoomKey,
  actionName: string,
  payload: Record<string, unknown>,
  requestedBy: string,
  evidenceRef: string,
): Record<string, unknown> {
  if (!(room === "commercial" && actionName === "sync_billing")) {
    return payload;
  }
  const billing = buildBillingVerificationState(payload, requestedBy, evidenceRef);
  return {
    source_type: billing.sourceType,
    component_paypal: billing.components.paypal,
    component_bank_transfer: billing.components.bankTransfer,
    component_btc_wallet: billing.components.btcWallet,
    component_eth_wallet: billing.components.ethWallet,
    is_connected: billing.isConnected,
    is_verified: billing.isVerified,
    verification_method: billing.verificationMethod,
    last_verified_at: billing.lastVerifiedAt,
    verified_by: billing.verifiedBy,
    evidence_ref: billing.evidenceRef,
    bank_account_label: billing.bankAccountLabel,
    bank_routing_last4: billing.bankRoutingLast4,
    bank_account_last4: billing.bankAccountLast4,
  };
}

function resolveRoom(input: string): RoomKey | null {
  const normalized = input.toLowerCase().replaceAll("-", "_");
  if (Object.hasOwn(ROOM_CONFIG, normalized)) {
    return normalized as RoomKey;
  }
  for (const [room, config] of Object.entries(ROOM_CONFIG) as Array<[RoomKey, RoomConfig]>) {
    if (config.aliases.includes(normalized)) return room;
  }
  return null;
}

function hasReasonCompanionFields(reason: RoomReasonRow): boolean {
  return Boolean(
    reason.reason_code?.trim() &&
    reason.reason_text?.trim() &&
    reason.evidence_ref?.trim() &&
    reason.next_action?.trim() &&
    reason.next_update_eta?.trim()
  );
}

function normalizeStatus(status: RoomStatus): "green" | "amber" | "red" {
  if (status === "yellow") return "amber";
  return status;
}

function coerceRoomStatus(status: string): RoomStatus {
  if (status === "green" || status === "yellow" || status === "amber" || status === "red") {
    return status;
  }
  return "red";
}

function parseActorRole(raw: unknown): ActorRole | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "authority" || normalized === "operator" || normalized === "system") {
    return normalized;
  }
  return null;
}

function buildConditionSplit(conditions: StopCondition[]): StopConditionSplit {
  return {
    hasReadBlockingConditions: conditions.some((condition) => condition.scope === "read"),
    hasWriteBlockingConditions: conditions.some((condition) => condition.scope === "write"),
    conditions: conditions.map((condition) => ({
      code: condition.code,
      scope: condition.scope,
      source: condition.source ?? "runtime",
    })),
  };
}

function downgradeSynthesizedSummary(
  room: RoomKey,
  summary: RoomSummaryRow,
  statusReasons: RoomReasonRow[],
): { summary: RoomSummaryRow; statusReasons: RoomReasonRow[] } {
  const normalized = normalizeStatus(summary.status);
  const downgradedStatus: RoomStatus = normalized === "green" ? "amber" : summary.status;
  const now = new Date().toISOString();
  const evidenceRef = summary.evidence_ref ?? `${room}:synthesized`;
  const summaryJson = { ...summary.summary_json };

  if (room === "commercial") {
    summaryJson["certificate_eligibility"] = "synthesized_unavailable";
    summaryJson["certificate_eligible"] = false;
    summaryJson["certificate_issue_ready"] = false;
  }

  const syntheticReason: RoomReasonRow = {
    id: randomUUID(),
    summary_id: summary.id,
    status: downgradedStatus,
    reason_code: "synthesized_mode",
    reason_text: "Synthesized mode active; green readiness is downgraded until authoritative state is available.",
    evidence_ref: evidenceRef,
    next_action: "connect_database_and_refresh",
    next_update_eta: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    created_at: now,
  };

  const reasons = statusReasons.length > 0 ? statusReasons : [syntheticReason];

  return {
    summary: {
      ...summary,
      status: downgradedStatus,
      summary_json: summaryJson,
      evidence_ref: evidenceRef,
      reason_count: reasons.length,
    },
    statusReasons: reasons,
  };
}

async function checkAuthorityReachability(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`${ENV.authorityBaseUrl}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

interface MarketTarget {
  symbol: string;
  name: string;
  source: string;
  status: "active" | "stale";
  lastPrice: number;
  delta24h: number;
  delta7d: number;
  volatilityClass: "low" | "medium" | "high";
  signalState: "bullish" | "bearish" | "neutral";
}

async function fetchMarketTargets(): Promise<{
  sourceStatus: "connected" | "disconnected";
  sourceReason: string;
  lastSyncUtc: string | null;
  targets: MarketTarget[];
}> {
  try {
    const [source, rows] = await Promise.all([
      queryOne<{
        source_name: string;
        status: string;
        last_sync_utc: string | null;
      }>(
        `SELECT source_name,
                status,
                last_sync_utc::text AS last_sync_utc
           FROM market_sources
          ORDER BY updated_at DESC
          LIMIT 1`,
      ).catch(() => null),
      query<{
        symbol: string;
        display_name: string;
        source_name: string;
        price: number | null;
        change_24h: number | null;
        change_7d: number | null;
        signal_state: string | null;
        captured_at: string | null;
      }>(
        `SELECT t.symbol,
                t.display_name,
                t.source_name,
                s.price,
                s.change_24h,
                s.change_7d,
                s.signal_state,
                s.captured_at::text AS captured_at
           FROM market_targets t
           LEFT JOIN LATERAL (
             SELECT price, change_24h, change_7d, signal_state, captured_at
               FROM market_snapshots ms
              WHERE ms.symbol = t.symbol
              ORDER BY captured_at DESC
              LIMIT 1
           ) s ON true
          WHERE t.is_active = true
          ORDER BY t.symbol ASC
          LIMIT 50`,
      ).catch(() => []),
    ]);

    const targets = rows.map((row): MarketTarget => {
      const delta24h = row.change_24h ?? 0;
      const delta7d = row.change_7d ?? 0;
      const absDelta = Math.max(Math.abs(delta24h), Math.abs(delta7d));
      const volatilityClass = absDelta >= 10 ? "high" : absDelta >= 4 ? "medium" : "low";
      const signalState: "bullish" | "bearish" | "neutral" =
        delta24h > 1 && delta7d > 1 ? "bullish" : delta24h < -1 && delta7d < -1 ? "bearish" : "neutral";

      return {
        symbol: row.symbol.toUpperCase(),
        name: row.display_name,
        source: row.source_name,
        status: row.price === null ? "stale" : "active",
        lastPrice: row.price ?? 0,
        delta24h,
        delta7d,
        volatilityClass,
        signalState,
      };
    });

    const sourceStatus: "connected" | "disconnected" =
      source?.status === "connected" && targets.length > 0 ? "connected" : "disconnected";

    return {
      sourceStatus,
      sourceReason: targets.length > 0 ? "ok" : "no_target_market_data",
      lastSyncUtc: source?.last_sync_utc ?? null,
      targets,
    };
  } catch {
    return {
      sourceStatus: "disconnected",
      sourceReason: "target_market_source_unavailable",
      lastSyncUtc: null,
      targets: [],
    };
  }
}

async function loadPrimaryRoomData(room: RoomKey): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();

  if (room === "camp") {
    const [identity, readme, contacts, licenses, documents, coordinationNotes, calendarEvents] = await Promise.all([
      queryOne<{
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
      ).catch(() => null),
      queryOne<{ paragraph: string }>(
        `SELECT paragraph
           FROM camp_readme
          ORDER BY updated_at DESC
          LIMIT 1`,
      ).catch(() => null),
      query<{
        contact_role: string;
        email: string;
      }>(
        `SELECT contact_role, email
           FROM camp_contacts
          ORDER BY contact_role ASC`,
      ).catch(() => []),
      query<{
        license_name: string;
        license_scope: string;
        license_status: string;
      }>(
        `SELECT license_name, license_scope, license_status
           FROM camp_licenses
         ORDER BY display_order ASC`,
      ).catch(() => []),
      query<{
        doc_key: string;
        title: string;
        body: string;
      }>(
        `SELECT doc_key, title, body
           FROM camp_documents
          ORDER BY doc_key ASC`,
      ).catch(() => []),
      query<{
        note_key: string;
        title: string;
        body: string;
        status: string;
        starts_at: string | null;
      }>(
        `SELECT note_key,
                title,
                body,
                status,
                starts_at::text AS starts_at
           FROM camp_coordination_notes
          ORDER BY updated_at DESC`,
      ).catch(() => []),
      query<{
        id: string;
        title: string;
        status: string;
        starts_at: string;
        owner: string | null;
        source: string;
      }>(
        `SELECT id::text AS id,
                title,
                status,
                starts_at::text AS starts_at,
                owner,
                source
           FROM calendar_events
          WHERE category IN ('policy', 'executive')
          ORDER BY starts_at ASC
          LIMIT 8`,
      ).catch(() => []),
    ]);

    const contactMap = new Map<string, string>();
    for (const contact of contacts) {
      contactMap.set(contact.contact_role.toLowerCase(), contact.email);
    }
    const documentMap = new Map<string, { title: string; body: string }>();
    for (const doc of documents) {
      documentMap.set(doc.doc_key.toLowerCase(), { title: doc.title, body: doc.body });
    }
    const coordinationObjects = [
      ...coordinationNotes.map((note) => ({
        id: note.note_key,
        title: note.title,
        body: note.body,
        status: note.status,
        starts_at: note.starts_at,
        source: "camp_coordination_notes",
      })),
      ...calendarEvents.map((event) => ({
        id: event.id,
        title: event.title,
        body: null as string | null,
        status: event.status,
        starts_at: event.starts_at,
        owner: event.owner,
        source: event.source,
      })),
    ];

    return {
      protocol_name: identity?.protocol_name ?? null,
      system_name: identity?.system_name ?? "VYRDX execution runtime",
      execution_model: identity?.execution_model ?? null,
      seal_policy: identity?.seal_policy ?? null,
      README: readme?.paragraph ?? documentMap.get("readme")?.body ?? null,
      doctrine_title: documentMap.get("doctrine")?.title ?? null,
      doctrine_body: documentMap.get("doctrine")?.body ?? null,
      pricing_title: documentMap.get("pricing")?.title ?? null,
      pricing_body: documentMap.get("pricing")?.body ?? null,
      contact_title: documentMap.get("contact")?.title ?? null,
      contact_body: documentMap.get("contact")?.body ?? null,
      documents: documents.map((doc) => ({
        doc_key: doc.doc_key,
        title: doc.title,
        body: doc.body,
      })),
      contact_operations_email: contactMap.get("operations") ?? contactMap.get("ops") ?? null,
      contact_authority_email: contactMap.get("authority") ?? null,
      contacts: contacts.map((contact) => ({
        contact_role: contact.contact_role,
        email: contact.email,
      })),
      licenses: licenses.map((license) => ({
        license_name: license.license_name,
        license_scope: license.license_scope,
        license_status: license.license_status,
      })),
      coordination_events: calendarEvents.map((event) => ({
        id: event.id,
        title: event.title,
        status: event.status,
        starts_at: event.starts_at,
        owner: event.owner,
        source: event.source,
      })),
      coordination_objects: coordinationObjects,
      calendar_reference_utc: now,
    };
  }

  if (room === "commercial") {
    const [billing, entitlement, cert, entitlements, certificates, contacts, calendarEvents] = await Promise.all([
      queryOne<{
        billing_source: string;
        source_type: BillingSourceType;
        component_paypal: boolean;
        component_bank_transfer: boolean;
        component_btc_wallet: boolean;
        component_eth_wallet: boolean;
        is_connected: boolean;
        is_verified: boolean;
        verification_method: string | null;
        last_verified_at: string | null;
        verified_by: string | null;
        evidence_ref: string | null;
        bank_account_label: string | null;
        bank_routing_last4: string | null;
        bank_account_last4: string | null;
        invoice_count_open: number;
        invoice_count_paid: number;
        invoice_count_failed: number;
        renewals_due_30d: number;
        last_billing_sync_utc: string | null;
      }>(
        `SELECT billing_source,
                source_type,
                component_paypal,
                component_bank_transfer,
                component_btc_wallet,
                component_eth_wallet,
                is_connected,
                is_verified,
                verification_method,
                last_verified_at::text AS last_verified_at,
                verified_by,
                evidence_ref,
                bank_account_label,
                bank_routing_last4,
                bank_account_last4,
                invoice_count_open,
                invoice_count_paid,
                invoice_count_failed,
                renewals_due_30d,
                last_billing_sync_utc::text AS last_billing_sync_utc
           FROM commercial_billing_summary
          WHERE NOT (
            COALESCE(verified_by, '') = 'system:seed'
            AND COALESCE(evidence_ref, '') = 'evd_seed_commercial_billing'
          )
          ORDER BY updated_at DESC
          LIMIT 1`,
      ).catch(() => null),
      queryOne<{ certificate_entitled_count: string }>(
        `SELECT COUNT(*) FILTER (WHERE certificate_entitled = true)::text AS certificate_entitled_count
           FROM commercial_entitlements`,
      ).catch(() => null),
      queryOne<{
        certificate_id: string;
        issued_at_utc: string;
        status: string;
        evidence_ref: string;
      }>(
        `SELECT certificate_id,
                issued_at_utc::text AS issued_at_utc,
                status,
                evidence_ref
           FROM commercial_certificates
          ORDER BY issued_at_utc DESC
          LIMIT 1`,
      ).catch(() => null),
      query<{
        license_id: string;
        plan_name: string;
        certificate_entitled: boolean;
        evidence_entitled: boolean;
        market_tier: string | null;
        monthly_cap: number | null;
        status: string;
        updated_at: string;
      }>(
        `SELECT license_id,
                plan_name,
                certificate_entitled,
                evidence_entitled,
                market_tier,
                monthly_cap,
                status,
                updated_at::text AS updated_at
           FROM commercial_entitlements
          ORDER BY updated_at DESC
          LIMIT 12`,
      ).catch(() => []),
      query<{
        certificate_id: string;
        license_id: string;
        issuer: string;
        status: string;
        evidence_ref: string;
        tx_hash: string | null;
        issued_at_utc: string;
      }>(
        `SELECT certificate_id,
                license_id,
                issuer,
                status,
                evidence_ref,
                tx_hash,
                issued_at_utc::text AS issued_at_utc
           FROM commercial_certificates
          ORDER BY issued_at_utc DESC
          LIMIT 10`,
      ).catch(() => []),
      query<{
        contact_role: string;
        email: string;
      }>(
        `SELECT contact_role, email
           FROM camp_contacts
          WHERE contact_role IN ('operations', 'ops', 'authority')
          ORDER BY contact_role ASC`,
      ).catch(() => []),
      query<{
        id: string;
        title: string;
        status: string;
        starts_at: string;
        source: string;
        action_url: string | null;
      }>(
        `SELECT id::text AS id,
                title,
                status,
                starts_at::text AS starts_at,
                source,
                action_url
           FROM calendar_events
          WHERE category = 'commercial'
          ORDER BY starts_at ASC
          LIMIT 12`,
      ).catch(() => []),
    ]);

    const certificateEntitled = Number(entitlement?.certificate_entitled_count ?? "0") > 0;
    const billingSource = billing?.billing_source ?? "not_connected";
    const contactMap = new Map<string, string>();
    for (const contact of contacts) {
      contactMap.set(contact.contact_role.toLowerCase(), contact.email);
    }
    const billingVerificationState: BillingVerificationState = {
      sourceType: billing?.source_type ?? "manual_verified",
      components: {
        paypal: Boolean(billing?.component_paypal),
        bankTransfer: Boolean(billing?.component_bank_transfer),
        btcWallet: Boolean(billing?.component_btc_wallet),
        ethWallet: Boolean(billing?.component_eth_wallet),
      },
      isConnected: Boolean(billing?.is_connected),
      isVerified: Boolean(billing?.is_verified),
      verificationMethod: billing?.verification_method ?? null,
      lastVerifiedAt: billing?.last_verified_at ?? null,
      verifiedBy: billing?.verified_by ?? null,
      evidenceRef: billing?.evidence_ref ?? null,
      bankAccountLabel: billing?.bank_account_label ?? null,
      bankRoutingLast4: billing?.bank_routing_last4 ?? null,
      bankAccountLast4: billing?.bank_account_last4 ?? null,
    };
    const billingReady = isBillingSourceLaunchVerified(billingVerificationState);

    return {
      billing_source: billingSource,
      source_type: billingVerificationState.sourceType,
      component_paypal: billingVerificationState.components.paypal,
      component_bank_transfer: billingVerificationState.components.bankTransfer,
      component_btc_wallet: billingVerificationState.components.btcWallet,
      component_eth_wallet: billingVerificationState.components.ethWallet,
      is_connected: billingVerificationState.isConnected,
      is_verified: billingVerificationState.isVerified,
      verification_method: billingVerificationState.verificationMethod,
      last_verified_at: billingVerificationState.lastVerifiedAt,
      verified_by: billingVerificationState.verifiedBy,
      billing_evidence_ref: billingVerificationState.evidenceRef,
      bank_account_label: billingVerificationState.bankAccountLabel,
      bank_routing_last4: billingVerificationState.bankRoutingLast4,
      bank_account_last4: billingVerificationState.bankAccountLast4,
      invoice_count_open: Number(billing?.invoice_count_open ?? 0),
      invoice_count_paid: Number(billing?.invoice_count_paid ?? 0),
      invoice_count_failed: Number(billing?.invoice_count_failed ?? 0),
      renewals_due_30d: Number(billing?.renewals_due_30d ?? 0),
      last_billing_sync_utc: billing?.last_billing_sync_utc ?? null,
      certificate_eligible: certificateEntitled,
      certificate_issue_ready: certificateEntitled && billingReady,
      last_certificate_id: cert?.certificate_id ?? null,
      last_issued_at_utc: cert?.issued_at_utc ?? null,
      certificate_status: cert?.status ?? null,
      certificate_evidence_ref: cert?.evidence_ref ?? null,
      entitlements: entitlements.map((entry) => ({
        license_id: entry.license_id,
        plan_name: entry.plan_name,
        certificate_entitled: entry.certificate_entitled,
        evidence_entitled: entry.evidence_entitled,
        market_tier: entry.market_tier,
        monthly_cap: entry.monthly_cap,
        status: entry.status,
        updated_at: entry.updated_at,
      })),
      certificates: certificates.map((entry) => ({
        certificate_id: entry.certificate_id,
        license_id: entry.license_id,
        issuer: entry.issuer,
        status: entry.status,
        evidence_ref: entry.evidence_ref,
        tx_hash: entry.tx_hash,
        issued_at_utc: entry.issued_at_utc,
      })),
      contacts: [
        ...(contactMap.get("operations")
          ? [{ contact_role: "operations", email: contactMap.get("operations") }]
          : []),
        ...(contactMap.get("ops")
          ? [{ contact_role: "ops", email: contactMap.get("ops") }]
          : []),
        ...(contactMap.get("authority")
          ? [{ contact_role: "authority", email: contactMap.get("authority") }]
          : []),
      ],
      contact_operations_email: contactMap.get("operations") ?? contactMap.get("ops") ?? null,
      contact_authority_email: contactMap.get("authority") ?? null,
      calendar_events: calendarEvents.map((event) => ({
        id: event.id,
        title: event.title,
        status: event.status,
        starts_at: event.starts_at,
        source: event.source,
        action_url: event.action_url,
      })),
    };
  }

  if (room === "market") {
    const [source, sourceRows, targetCount, intelHead, targets, intelRows, sentimentCounts, competitorLinks] = await Promise.all([
      queryOne<{
        source_name: string;
        status: string;
        last_sync_utc: string | null;
        last_error: string | null;
      }>(
        `SELECT source_name,
                status,
                last_sync_utc::text AS last_sync_utc,
                last_error
           FROM market_sources
          WHERE source_name <> 'coingecko'
          ORDER BY updated_at DESC
          LIMIT 1`,
      ).catch(() => null),
      query<{
        source_name: string;
        status: string;
        base_url: string | null;
        last_sync_utc: string | null;
        last_error: string | null;
      }>(
        `SELECT source_name,
                status,
                base_url,
                last_sync_utc::text AS last_sync_utc,
                last_error
           FROM market_sources
          ORDER BY updated_at DESC`,
      ).catch(() => []),
      queryOne<{ target_count: string }>(
        `SELECT COUNT(*) FILTER (WHERE is_active = true AND source_name <> 'coingecko')::text AS target_count
           FROM market_targets`,
      ).catch(() => null),
      queryOne<{ latest_intel_utc: string | null }>(
        `SELECT MAX(captured_at)::text AS latest_intel_utc
           FROM market_intel_rows`,
      ).catch(() => null),
      query<{
        symbol: string;
        display_name: string;
        source_name: string;
        metadata: Record<string, unknown>;
        intel_count: number;
        last_intel_utc: string | null;
      }>(
        `SELECT t.symbol,
                t.display_name,
                t.source_name,
                t.metadata,
                COALESCE(intel.intel_count, 0)::int AS intel_count,
                intel.last_intel_utc::text AS last_intel_utc
           FROM market_targets t
           LEFT JOIN LATERAL (
             SELECT COUNT(*)::int AS intel_count,
                    MAX(captured_at)::text AS last_intel_utc
               FROM market_intel_rows mir
              WHERE mir.symbol = t.symbol
           ) intel ON true
          WHERE t.is_active = true
            AND t.source_name <> 'coingecko'
          ORDER BY
            COALESCE(
              NULLIF(regexp_replace(t.metadata->>'launch_wave', '[^0-9]', '', 'g'), '')::int,
              999
            ),
            COALESCE(NULLIF(t.metadata->>'launch_wave_order', '')::int, 999),
            CASE (t.metadata->>'priority')
              WHEN 'critical' THEN 0
              WHEN 'high' THEN 1
              WHEN 'medium' THEN 2
              WHEN 'low' THEN 3
              ELSE 4
            END,
            COALESCE(intel.last_intel_utc, t.updated_at::text) DESC,
            t.symbol ASC
          LIMIT 50`,
      ).catch(() => []),
      query<{
        symbol: string;
        display_name: string | null;
        source_name: string;
        headline: string;
        url: string | null;
        signal_type: string;
        sentiment: string;
        impact_score: number | null;
        captured_at: string;
        notes: string | null;
      }>(
        `SELECT r.symbol,
                t.display_name,
                r.source_name,
                r.headline,
                r.url,
                r.signal_type,
                r.sentiment,
                r.impact_score,
                r.captured_at::text AS captured_at,
                r.notes
           FROM market_intel_rows r
           LEFT JOIN market_targets t ON t.symbol = r.symbol
          ORDER BY r.captured_at DESC
          LIMIT 20`,
      ).catch(() => []),
      query<{ sentiment: string; count: number }>(
        `SELECT sentiment,
                COUNT(*)::int AS count
           FROM market_intel_rows
          WHERE captured_at > now() - interval '30 days'
          GROUP BY sentiment
          ORDER BY COUNT(*) DESC`,
      ).catch(() => []),
      query<{
        symbol: string;
        competitor_symbol: string;
        competitor_name: string | null;
        relation: string;
      }>(
        `SELECT c.symbol,
                c.competitor_symbol,
                t.display_name AS competitor_name,
                c.relation
           FROM market_competitors c
           LEFT JOIN market_targets t ON t.symbol = c.competitor_symbol
          ORDER BY c.created_at DESC
          LIMIT 50`,
      ).catch(() => []),
    ]);

    function metaString(meta: Record<string, unknown> | null | undefined, key: string): string | null {
      if (!meta) return null;
      const raw = meta[key];
      if (typeof raw !== "string") return null;
      const value = raw.trim();
      return value.length > 0 ? value : null;
    }
    function metaStringArray(meta: Record<string, unknown> | null | undefined, key: string): string[] {
      if (!meta) return [];
      const raw = meta[key];
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }

    const sourceMap = new Map<string, {
      source_name: string;
      status: string;
      base_url: string | null;
      last_sync_utc: string | null;
      last_error: string | null;
    }>();
    for (const row of sourceRows) {
      sourceMap.set(row.source_name, row);
    }

    return {
      source_01_name: source?.source_name ?? "target_market_registry",
      source_01_status: source?.status ?? "disconnected",
      source_01_last_sync_utc: source?.last_sync_utc ?? null,
      source_01_last_error: source?.last_error ?? null,
      market_scope: "target_market_intelligence",
      target_universe_count: Number(targetCount?.target_count ?? "0"),
      latest_intel_utc: intelHead?.latest_intel_utc ?? null,
      sentiment_counts_30d: sentimentCounts.map((row) => ({
        sentiment: row.sentiment,
        count: row.count,
      })),
      targets: targets.map((target) => ({
        symbol: target.symbol,
        display_name: target.display_name,
        source_name: target.source_name,
        source_status: sourceMap.get(target.source_name)?.status ?? null,
        source_base_url: sourceMap.get(target.source_name)?.base_url ?? null,
        source_last_sync_utc: sourceMap.get(target.source_name)?.last_sync_utc ?? null,
        source_last_error: sourceMap.get(target.source_name)?.last_error ?? null,
        sources: metaStringArray(target.metadata, "sources"),
        sector: metaString(target.metadata, "sector"),
        region: metaString(target.metadata, "region"),
        stage: metaString(target.metadata, "stage"),
        priority: metaString(target.metadata, "priority"),
        launch_wave: metaString(target.metadata, "launch_wave"),
        status: metaString(target.metadata, "status"),
        summary: metaString(target.metadata, "summary"),
        notes: metaString(target.metadata, "notes"),
        buyer_title: metaString(target.metadata, "buyer_title"),
        offer_fit: metaString(target.metadata, "offer_fit"),
        acquisition_channel: metaString(target.metadata, "acquisition_channel"),
        pain: metaString(target.metadata, "pain"),
        intel_count: target.intel_count,
        last_intel_utc: target.last_intel_utc,
      })),
      intel_rows: intelRows.map((row) => ({
        symbol: row.symbol,
        display_name: row.display_name,
        source_name: row.source_name,
        headline: row.headline,
        url: row.url,
        signal_type: row.signal_type,
        sentiment: row.sentiment,
        impact_score: row.impact_score,
        captured_at: row.captured_at,
        notes: row.notes,
      })),
      competitors: competitorLinks.map((row) => ({
        symbol: row.symbol,
        competitor_symbol: row.competitor_symbol,
        competitor_name: row.competitor_name ?? row.competitor_symbol,
        relation: row.relation,
      })),
    };
  }

  if (room === "evidence") {
    const [summary, head] = await Promise.all([
      queryOne<{ total: string; recent: string }>(
        `SELECT COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE created_at > now() - interval '1 day')::text AS recent
           FROM evidence_ledger`,
      ).catch(() => null),
      queryOne<{ evidence_ref: string; chain_hash: string; created_at: string }>(
        `SELECT evidence_ref, chain_hash, created_at::text AS created_at
           FROM evidence_ledger
          ORDER BY id DESC
          LIMIT 1`,
      ).catch(() => null),
    ]);
    return {
      total_seals: Number(summary?.total ?? "0"),
      recent_evidence_events_24h: Number(summary?.recent ?? "0"),
      chain_head_hash: head?.chain_hash ?? null,
      last_evidence_ref: head?.evidence_ref ?? null,
      last_append_time: head?.created_at ?? null,
    };
  }

  if (room === "system") {
    const [boundary, isolation] = await Promise.all([
      queryOne<{
        boundary_owner: string;
        timelock_address: string | null;
        guardian_address: string | null;
        owner_is_eoa: boolean;
        status: string;
        evidence_ref: string | null;
      }>(
        `SELECT boundary_owner,
                timelock_address,
                guardian_address,
                owner_is_eoa,
                status,
                evidence_ref
           FROM system_boundary_state
          ORDER BY updated_at DESC
          LIMIT 1`,
      ).catch(() => null),
      queryOne<{
        hardened_count: string;
        total_count: string;
        latest_canary_status: string | null;
        latest_rollback_status: string | null;
      }>(
        `SELECT COUNT(*) FILTER (WHERE rootfs_read_only = true AND dropped_caps = true AND explicit_mounts_only = true)::text AS hardened_count,
                COUNT(*)::text AS total_count,
                MAX(canary_status)::text AS latest_canary_status,
                MAX(rollback_proof_status)::text AS latest_rollback_status
           FROM system_runtime_isolation`,
      ).catch(() => null),
    ]);

    return {
      boundary_owner: boundary?.boundary_owner ?? null,
      timelock_address: boundary?.timelock_address ?? null,
      guardian_address: boundary?.guardian_address ?? null,
      boundary_owner_is_eoa: Boolean(boundary?.owner_is_eoa ?? true),
      boundary_status: boundary?.status ?? "unverified",
      boundary_evidence_ref: boundary?.evidence_ref ?? null,
      isolation_hardened_count: Number(isolation?.hardened_count ?? "0"),
      isolation_total_count: Number(isolation?.total_count ?? "0"),
      latest_canary_status: isolation?.latest_canary_status ?? "unverified",
      latest_rollback_status: isolation?.latest_rollback_status ?? "unverified",
    };
  }

  if (room === "reports_plans") {
    const [deploy, incidents] = await Promise.all([
      queryOne<{ release_id: string; status: string; created_at: string }>(
        `SELECT release_id, status, created_at::text AS created_at
           FROM deployments
          ORDER BY created_at DESC
          LIMIT 1`,
      ).catch(() => null),
      queryOne<{ blocker_count: string }>(
        `SELECT COUNT(*) FILTER (WHERE status IN ('open','mitigating'))::text AS blocker_count
           FROM incidents`,
      ).catch(() => null),
    ]);

    return {
      current_blockers: Number(incidents?.blocker_count ?? "0"),
      last_release_id: deploy?.release_id ?? null,
      last_canary_result: deploy?.status ?? "unknown",
      last_release_at_utc: deploy?.created_at ?? null,
    };
  }

  if (room === "ops") {
    const [openIncidents, deadJobs, jobTotals, isolation] = await Promise.all([
      queryOne<{ c: string }>("SELECT COUNT(*)::text AS c FROM incidents WHERE status IN ('open','mitigating')").catch(() => null),
      queryOne<{ c: string }>("SELECT COUNT(*)::text AS c FROM job_runs WHERE status = 'dead'").catch(() => null),
      queryOne<{ total: string; running: string }>(
        `SELECT COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE status = 'running')::text AS running
           FROM job_runs`,
      ).catch(() => null),
      queryOne<{ canary_status: string | null; rollback_status: string | null }>(
        `SELECT MAX(canary_status)::text AS canary_status,
                MAX(rollback_proof_status)::text AS rollback_status
           FROM system_runtime_isolation`,
      ).catch(() => null),
    ]);
    return {
      incidents_open: Number(openIncidents?.c ?? "0"),
      dead_jobs: Number(deadJobs?.c ?? "0"),
      total_jobs: Number(jobTotals?.total ?? "0"),
      running_jobs: Number(jobTotals?.running ?? "0"),
      last_canary_result: isolation?.canary_status ?? "unverified",
      rollback_proof_status: isolation?.rollback_status ?? "unverified",
    };
  }

  return {};
}

async function buildSynthSummary(room: RoomKey): Promise<{
  status: RoomStatus;
  summaryJson: Record<string, unknown>;
  evidenceRef: string | null;
  reasons: RoomReasonRow[];
}> {
  const now = new Date().toISOString();

  if (room === "camp") {
    const licenses = [
      {
        license_01_name: "cloudflare_access",
        license_01_scope: "edge policy and ingress",
        license_01_status: process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET ? "active" : "unverified",
      },
      {
        license_02_name: "arbitrum_runtime",
        license_02_scope: "on-chain proof and verification",
        license_02_status: process.env.RPC_URL ? "active" : "unverified",
      },
      {
        license_03_name: "tailscale_path",
        license_03_scope: "private authority-execution routing",
        license_03_status: process.env.TAILSCALE_IP ? "active" : "unverified",
      },
    ];

    const unverified = licenses.filter((entry) => Object.values(entry).includes("unverified")).length;
    const status: RoomStatus = unverified === 0 ? "green" : "yellow";
    return {
      status,
      evidenceRef: "camp:identity:runtime",
      summaryJson: {
        room_name: "VYRDX",
        system_name: "Execution cloud by VYRDON",
        protocol_name: "VYRDX-ECP-2026",
        execution_model: "sealed deterministic runtime",
        seal_policy: "proof required before publication",
        README:
          "This VYRDX runtime operates as a sealed execution environment. Actions entering the runtime are evaluated through boundary policy, recorded into evidence, and published only after integrity checks pass. Unauthorized mutation, reinterpretation, or unsigned execution is rejected at the control boundary.",
        contact_operations_email: process.env.OPS_CONTACT_EMAIL ?? "ops@vyrdon.com",
        contact_authority_email: process.env.AUTHORITY_CONTACT_EMAIL ?? "authority@vyrdon.com",
        ...licenses[0],
        ...licenses[1],
        ...licenses[2],
      },
      reasons: status === "green" ? [] : [{
        id: randomUUID(),
        summary_id: null,
        status,
        reason_code: "license_verification_incomplete",
        reason_text: "One or more CAMP licenses are unverified.",
        evidence_ref: "camp:licenses:verification",
        next_action: "refresh_licenses",
        next_update_eta: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        created_at: now,
      }],
    };
  }

  if (room === "commercial") {
    const [workspaceStats, invoiceStats] = await Promise.all([
      queryOne<{ active_paid: string; free_only: string }>(`
        SELECT
          COUNT(*) FILTER (WHERE plan <> 'free')::text AS active_paid,
          COUNT(*) FILTER (WHERE plan = 'free')::text AS free_only
        FROM workspaces
      `).catch(() => null),
      queryOne<{ open: string; paid: string; failed: string }>(`
        SELECT
          COUNT(*) FILTER (WHERE event_type IN ('invoice_issued', 'invoice_overdue'))::text AS open,
          COUNT(*) FILTER (WHERE event_type = 'invoice_paid')::text AS paid,
          COUNT(*) FILTER (WHERE event_type = 'invoice_failed')::text AS failed
        FROM billing_events
      `).catch(() => null),
    ]);

    const synthComponents = {
      paypal: Boolean(PAYMENT_CONFIG.paypalMeUrl),
      bankTransfer: Boolean(PAYMENT_CONFIG.bank.accountNumber || PAYMENT_CONFIG.bank.routingNumber),
      btcWallet: Boolean(PAYMENT_CONFIG.btc.address),
      ethWallet: Boolean(PAYMENT_CONFIG.eth.address),
    };
    const billingSourceConnected =
      synthComponents.paypal ||
      synthComponents.bankTransfer ||
      synthComponents.btcWallet ||
      synthComponents.ethWallet;
    const synthSourceType = normalizeBillingSourceType(undefined, synthComponents);
    const failed = parseInt(invoiceStats?.failed ?? "0", 10);
    const status: RoomStatus = !billingSourceConnected ? "yellow" : failed > 0 ? "yellow" : "green";
    return {
      status,
      evidenceRef: "commercial:summary:billing",
      summaryJson: {
        active_license_count: parseInt(workspaceStats?.active_paid ?? "0", 10),
        active_plan_names: ["free", "solo", "business", "enterprise"],
        billing_status: status,
        certificate_eligibility: "plan_and_evidence_required",
        invoice_count_open: parseInt(invoiceStats?.open ?? "0", 10),
        invoice_count_paid: parseInt(invoiceStats?.paid ?? "0", 10),
        invoice_count_failed: failed,
        renewals_due_30d: 0,
        last_billing_sync_utc: now,
        billing_source: billingSourceConnected ? "connected" : "not_connected",
        source_type: synthSourceType,
        component_paypal: synthComponents.paypal,
        component_bank_transfer: synthComponents.bankTransfer,
        component_btc_wallet: synthComponents.btcWallet,
        component_eth_wallet: synthComponents.ethWallet,
        is_connected: billingSourceConnected,
        is_verified: false,
        verification_method: null,
        last_verified_at: null,
        verified_by: null,
        billing_evidence_ref: null,
        bank_account_label: maskBankLabel(PAYMENT_CONFIG.bank.accountName),
        bank_routing_last4: extractLast4(PAYMENT_CONFIG.bank.routingNumber),
        bank_account_last4: extractLast4(PAYMENT_CONFIG.bank.accountNumber),
      },
      reasons: status === "green" ? [] : [{
        id: randomUUID(),
        summary_id: null,
        status,
        reason_code: billingSourceConnected ? "failed_payments_present" : "billing_source_not_connected",
        reason_text: billingSourceConnected
          ? "One or more failed payments require verification."
          : "Billing source not connected.",
        evidence_ref: "commercial:billing:state",
        next_action: billingSourceConnected ? "sync_billing" : "sync_billing",
        next_update_eta: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        created_at: now,
      }],
    };
  }

  if (room === "evidence") {
    const [summary, chain] = await Promise.all([
      queryOne<{ total: string; failed: string; signed: string; verified: string }>(`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE verified = false)::text AS failed,
          COUNT(*) FILTER (WHERE signed = true)::text AS signed,
          COUNT(*) FILTER (WHERE verified = true)::text AS verified
        FROM evidence_events
      `).catch(() => null),
      queryOne<{ event_hash: string; created_at: string }>(
        "SELECT event_hash, created_at::text FROM evidence_events ORDER BY created_at DESC LIMIT 1"
      ).catch(() => null),
    ]);

    const failed = parseInt(summary?.failed ?? "0", 10);
    const total = parseInt(summary?.total ?? "0", 10);
    const status: RoomStatus = total === 0 ? "yellow" : failed > 0 ? "yellow" : "green";
    return {
      status,
      evidenceRef: chain?.event_hash ?? "evidence:chain:head:missing",
      summaryJson: {
        total_seals: total,
        valid_seals: parseInt(summary?.verified ?? "0", 10),
        failed_seals: failed,
        chain_head_hash: chain?.event_hash ?? null,
        last_append_time: chain?.created_at ?? null,
        integrity_status: failed === 0 ? "ok" : "degraded",
        queue_depth: 0,
        pending_verifications: 0,
        failed_verifications: failed,
        stuck_jobs: 0,
        retry_policy_state: "active",
      },
      reasons: status === "green" ? [] : [{
        id: randomUUID(),
        summary_id: null,
        status,
        reason_code: total === 0 ? "no_evidence_events" : "verification_failures_present",
        reason_text: total === 0
          ? "Evidence chain has no production events yet."
          : "Evidence verification failures detected.",
        evidence_ref: chain?.event_hash ?? "evidence:chain:bootstrap",
        next_action: "reverify_proof",
        next_update_eta: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
        created_at: now,
      }],
    };
  }

  if (room === "market") {
    const market = await fetchMarketTargets();
    const targetCount = market.targets.length;
    const status: RoomStatus = market.sourceStatus === "connected" && targetCount > 0 ? "green" : "yellow";

    return {
      status,
      evidenceRef: market.lastSyncUtc ? `market:sync:${market.lastSyncUtc}` : "market:sync:missing",
      summaryJson: {
        target_universe_count: targetCount,
        market_scope: "target_market_intelligence",
        source_01_name: "target_market_registry",
        source_01_status: market.sourceStatus,
        source_01_last_sync_utc: market.lastSyncUtc,
        latest_intel_utc: null,
        sentiment_counts_30d: [],
        review_timestamp: now,
        targets: market.targets,
        intel_rows: [],
        competitors: [],
      },
      reasons: status === "green" ? [] : [{
        id: randomUUID(),
        summary_id: null,
        status,
        reason_code: targetCount === 0 ? "target_registry_empty" : "market_source_disconnected",
        reason_text: targetCount === 0
          ? "Target market registry is empty."
          : "Market source disconnected.",
        evidence_ref: "market:targets:integrity",
        next_action: "refresh_market_sources",
        next_update_eta: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        created_at: now,
      }],
    };
  }

  if (room === "reports_plans") {
    const [deploy, incidents] = await Promise.all([
      queryOne<{ release_id: string; status: string; created_at: string }>(
        "SELECT release_id, status, created_at::text FROM deployments ORDER BY created_at DESC LIMIT 1"
      ).catch(() => null),
      queryOne<{ blockers: string }>(
        "SELECT COUNT(*) FILTER (WHERE status IN ('open','mitigating'))::text AS blockers FROM incidents"
      ).catch(() => null),
    ]);
    const blockerCount = parseInt(incidents?.blockers ?? "0", 10);
    const status: RoomStatus = blockerCount > 0 ? "yellow" : "green";
    return {
      status,
      evidenceRef: deploy?.release_id ?? "reports_plans:release:missing",
      summaryJson: {
        current_freeze_state: process.env.ROOM_FREEZE_STATE ?? "active",
        current_blockers: blockerCount,
        last_canary_result: deploy?.status ?? "unknown",
        rollback_proof_status: process.env.ROLLBACK_PROOF_STATUS ?? "unverified",
        last_seal_decision: "commercial_certificate_gate",
        next_review_eta: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      reasons: status === "green" ? [] : [{
        id: randomUUID(),
        summary_id: null,
        status,
        reason_code: "blockers_present",
        reason_text: `${blockerCount} blockers are open in incident queue.`,
        evidence_ref: "reports_plans:blockers",
        next_action: "update_execution_plan",
        next_update_eta: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        created_at: now,
      }],
    };
  }

  if (room === "system") {
    const authorityReachable = await checkAuthorityReachability();
    const attestationValid = Boolean(process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET);
    const boundaryOwnerEoa = process.env.BOUNDARY_OWNER_IS_EOA === "true";
    const timelockWired = process.env.TIMELOCK_ADDRESS !== undefined && process.env.TIMELOCK_ADDRESS.length > 0;
    const guardianWired = process.env.GUARDIAN_ADDRESS !== undefined && process.env.GUARDIAN_ADDRESS.length > 0;

    const blockers = [
      !authorityReachable ? "asus_reachability" : null,
      !attestationValid ? "attestation_refresh_failure" : null,
      !timelockWired ? "timelock_not_wired" : null,
      !guardianWired ? "guardian_not_wired" : null,
      boundaryOwnerEoa ? "boundary_owner_still_eoa" : null,
    ].filter(Boolean) as string[];

    const status: RoomStatus = blockers.length === 0 ? "green" : blockers.includes("boundary_owner_still_eoa") ? "red" : "yellow";
    return {
      status,
      evidenceRef: "system:trust-closure",
      summaryJson: {
        trust_closure: blockers.length === 0 ? "closed" : "open",
        attestation_status: attestationValid ? "valid" : "invalid",
        boundary_ownership_state: boundaryOwnerEoa ? "eoa" : "governed",
        container_isolation_state: process.env.CONTAINER_HARDENING_STATE ?? "unverified",
        blockers,
      },
      reasons: blockers.map((blocker) => ({
        id: randomUUID(),
        summary_id: null,
        status,
        reason_code: blocker,
        reason_text: blocker.replaceAll("_", " "),
        evidence_ref: `system:${blocker}`,
        next_action: "refresh_trust_closure",
        next_update_eta: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        created_at: now,
      })),
    };
  }

  // ops
  const [openIncidents, deadJobs] = await Promise.all([
    queryOne<{ c: string }>("SELECT COUNT(*)::text AS c FROM incidents WHERE status IN ('open','mitigating')").catch(() => null),
    queryOne<{ c: string }>("SELECT COUNT(*)::text AS c FROM job_runs WHERE status = 'dead'").catch(() => null),
  ]);
  const incidents = parseInt(openIncidents?.c ?? "0", 10);
  const dead = parseInt(deadJobs?.c ?? "0", 10);
  const status: RoomStatus = incidents > 0 || dead > 0 ? "yellow" : "green";
  return {
    status,
    evidenceRef: "ops:runtime:summary",
    summaryJson: {
      controlled_actions_only: true,
      incidents_open: incidents,
      dead_jobs: dead,
      freeze_discipline: process.env.ROOM_FREEZE_STATE ?? "active",
      rehearsals_state: process.env.REHEARSAL_STATE ?? "pending",
    },
    reasons: status === "green" ? [] : [{
      id: randomUUID(),
      summary_id: null,
      status,
      reason_code: incidents > 0 ? "incidents_open" : "dead_jobs_present",
      reason_text: incidents > 0
        ? `${incidents} incidents are open or mitigating.`
        : `${dead} dead jobs need operator review.`,
      evidence_ref: "ops:incident:queue",
      next_action: "health_refresh",
      next_update_eta: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      created_at: now,
    }],
  };
}

function buildPrimaryDbMissingSummary(room: RoomKey): {
  status: RoomStatus;
  summaryJson: Record<string, unknown>;
  evidenceRef: string;
  reasons: RoomReasonRow[];
} {
  const now = new Date().toISOString();
  const evidenceRef = `room:${room}:summary_missing`;
  return {
    status: "amber",
    summaryJson: {
      runtime_mode: "primary_db",
      room_key: room,
      source: "database",
      summary_state: "missing",
      message: "Room summary row is missing in primary_db mode.",
    },
    evidenceRef,
    reasons: [{
      id: randomUUID(),
      summary_id: room,
      status: "amber",
      reason_code: "room_summary_missing",
      reason_text: "room_summary is missing for this room in primary_db mode.",
      evidence_ref: evidenceRef,
      next_action: "refresh_room_summary",
      next_update_eta: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      created_at: now,
    }],
  };
}

async function loadBackbone(room: RoomKey): Promise<{
  summary: RoomSummaryRow;
  statusReasons: RoomReasonRow[];
  changeEvents: RoomEventRow[];
  actions: RoomActionRow[];
  synthesized: boolean;
}> {
  const config = ROOM_CONFIG[room];
  const primaryRoomData = await loadPrimaryRoomData(room);
  const summaryRow = await queryOne<{
    room_key: string;
    status_color: string;
    reason_code: string | null;
    reason_text: string | null;
    delta_summary: string | null;
    updated_at_utc: string;
    owner: string;
    evidence_ref: string | null;
    next_action: string | null;
    next_update_eta: string | null;
  }>(
    `SELECT room_key,
            status_color::text AS status_color,
            reason_code,
            reason_text,
            delta_summary,
            updated_at_utc::text AS updated_at_utc,
            owner,
            evidence_ref,
            next_action,
            next_update_eta::text AS next_update_eta
       FROM room_summary
      WHERE room_key = $1
      LIMIT 1`,
    [room],
  ).catch(() => null);

  const [reasonRows, changeEventsRows, actionRows] = await Promise.all([
    query<{
      id: string;
      reason_code: string;
      reason_text: string;
      evidence_ref: string | null;
      created_at: string;
      created_by: string;
    }>(
      `SELECT id::text AS id,
              reason_code,
              reason_text,
              evidence_ref,
              created_at::text AS created_at,
              created_by
         FROM room_status_reasons
        WHERE room_key = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [room],
    ).catch(() => []),
    query<{
      id: string;
      event_type: string;
      event_payload: Record<string, unknown>;
      evidence_ref: string | null;
      created_by: string;
      created_at: string;
    }>(
      `SELECT id::text AS id,
              event_type,
              event_payload,
              evidence_ref,
              created_by,
              created_at::text AS created_at
         FROM room_change_events
        WHERE room_key = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [room],
    ).catch(() => []),
    query<{
      id: string;
      action_key: string;
      action_label: string;
      is_enabled: boolean;
      requires_policy: boolean;
      requires_evidence: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id::text AS id,
              action_key,
              action_label,
              is_enabled,
              requires_policy,
              requires_evidence,
              created_at::text AS created_at,
              updated_at::text AS updated_at
         FROM room_actions
        WHERE room_key = $1
        ORDER BY updated_at DESC
        LIMIT 50`,
      [room],
    ).catch(() => []),
  ]);

  if (summaryRow) {
    const summaryStatus = coerceRoomStatus(summaryRow.status_color);
    const nowIso = new Date().toISOString();
    const fallbackNextAction = summaryRow.next_action ?? "refresh_status_reasons";
    const fallbackNextUpdateEta = summaryRow.next_update_eta ?? new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const statusReasons: RoomReasonRow[] = reasonRows.map((row) => ({
      id: row.id,
      summary_id: summaryRow.room_key,
      status: summaryStatus,
      reason_code: row.reason_code,
      reason_text: row.reason_text,
      evidence_ref: row.evidence_ref ?? summaryRow.evidence_ref ?? `${room}:status_reason:${row.id}`,
      next_action: fallbackNextAction,
      next_update_eta: fallbackNextUpdateEta,
      created_at: row.created_at,
    }));

    const mandatoryReasons = summaryStatus === "green"
      ? statusReasons
      : statusReasons.filter(hasReasonCompanionFields);
    const backfilledReasons = summaryStatus !== "green" && mandatoryReasons.length === 0
      ? [{
          id: randomUUID(),
          summary_id: summaryRow.room_key,
          status: summaryStatus,
          reason_code: summaryRow.reason_code ?? "status_reason_missing",
          reason_text: summaryRow.reason_text ?? "Room summary is non-green but no mandatory status reasons are recorded.",
          evidence_ref: summaryRow.evidence_ref ?? `${room}:missing_status_reason`,
          next_action: fallbackNextAction,
          next_update_eta: fallbackNextUpdateEta,
          created_at: nowIso,
        }]
      : mandatoryReasons;

    const summary: RoomSummaryRow = {
      id: summaryRow.room_key,
      status: summaryStatus,
      summary_json: {
        delta_summary: summaryRow.delta_summary,
        ...primaryRoomData,
      },
      reason_count: backfilledReasons.length,
      evidence_ref: summaryRow.evidence_ref,
      record_class: config.recordClass,
      updated_at: summaryRow.updated_at_utc,
      created_at: summaryRow.updated_at_utc,
    };

    const changeEvents: RoomEventRow[] = changeEventsRows.map((row) => ({
      id: row.id,
      event_type: row.event_type,
      event_payload: row.event_payload,
      evidence_ref: row.evidence_ref,
      actor: row.created_by,
      happened_at: row.created_at,
    }));

    const actions: RoomActionRow[] = actionRows.map((row) => ({
      id: row.id,
      action_name: row.action_key,
      action_payload: {
        label: row.action_label,
        requiresPolicy: row.requires_policy,
        requiresEvidence: row.requires_evidence,
      },
      requested_by: "system",
      status: row.is_enabled ? "open" : "blocked",
      evidence_ref: null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return {
      summary,
      statusReasons: backfilledReasons,
      changeEvents,
      actions,
      synthesized: false,
    };
  }

  const runtime = runtimeModeService.getRuntimeModeSnapshot();
  if (runtime.runtimeMode === "primary_db") {
    const primary = buildPrimaryDbMissingSummary(room);
    const now = new Date().toISOString();
    return {
      summary: {
        id: randomUUID(),
        status: primary.status,
        summary_json: {
          ...primaryRoomData,
          ...primary.summaryJson,
        },
        reason_count: primary.reasons.length,
        evidence_ref: primary.evidenceRef,
        record_class: config.recordClass,
        updated_at: now,
        created_at: now,
      },
      statusReasons: primary.reasons,
      changeEvents: [],
      actions: [],
      synthesized: false,
    };
  }

  const synth = await buildSynthSummary(room);
  const now = new Date().toISOString();
  const fallbackSummary: RoomSummaryRow = {
    id: randomUUID(),
    status: synth.status,
    summary_json: synth.summaryJson,
    reason_count: synth.reasons.length,
    evidence_ref: synth.evidenceRef,
    record_class: config.recordClass,
    updated_at: now,
    created_at: now,
  };

  const fallbackEvents: RoomEventRow[] = [{
    id: randomUUID(),
    event_type: "room_contract_eval",
    event_payload: { synthesized: true, room, status: synth.status },
    evidence_ref: synth.evidenceRef,
    actor: "system",
    happened_at: now,
  }];

  const fallbackActions: RoomActionRow[] = config.allowedActions.slice(0, 4).map((actionName) => ({
    id: randomUUID(),
    action_name: actionName,
    action_payload: { suggested: true },
    requested_by: "system",
    status: "open",
    evidence_ref: synth.evidenceRef,
    created_at: now,
    updated_at: now,
  }));

  return {
    summary: fallbackSummary,
    statusReasons: synth.reasons,
    changeEvents: fallbackEvents,
    actions: fallbackActions,
    synthesized: true,
  };
}

function pushStopCondition(list: StopCondition[], next: StopCondition): void {
  const normalized: StopCondition = {
    code: next.code,
    scope: next.scope,
    source: next.source ?? "runtime",
  };
  const exists = list.some((item) =>
    item.code === normalized.code &&
    item.scope === normalized.scope &&
    (item.source ?? "runtime") === normalized.source,
  );
  if (!exists) {
    list.push(normalized);
  }
}

async function collectStopConditions(
  room: RoomKey,
  summary: RoomSummaryRow,
  reasons: RoomReasonRow[],
  synthesized: boolean,
): Promise<StopCondition[]> {
  const stopConditions: StopCondition[] = [];
  const normalizedStatus = normalizeStatus(summary.status);
  const primaryReason = reasons[0];
  const runtime = runtimeModeService.getRuntimeModeSnapshot();
  const summaryState =
    typeof summary.summary_json?.["summary_state"] === "string"
      ? summary.summary_json["summary_state"].trim().toLowerCase()
      : "";
  const explicitExemptionCode =
    typeof summary.summary_json?.["explicit_exemption_code"] === "string"
      ? summary.summary_json["explicit_exemption_code"].trim()
      : "";

  if (runtime.runtimeMode !== "primary_db") {
    pushStopCondition(stopConditions, { code: "database_unavailable", scope: "write", source: "runtime_mode" });
  } else if (summaryState === "missing") {
    pushStopCondition(stopConditions, { code: "room_summary_missing_primary_db", scope: "write", source: "room_summary" });
  }

  if (ENV.isCloud && runtime.runtimeMode === "primary_db" && !isZeroTrustServiceTokenConfigured()) {
    pushStopCondition(stopConditions, { code: "zero_trust_not_configured", scope: "write", source: "zero_trust_guard" });
  }

  if (synthesized) {
    pushStopCondition(stopConditions, { code: "synthesized_mode", scope: "write", source: "synth_fallback" });
  }

  if (normalizedStatus !== "green" && reasons.length === 0) {
    pushStopCondition(stopConditions, { code: "status_non_green_without_reasons", scope: "read", source: "room_status_reasons" });
  }

  if (normalizedStatus !== "green") {
    const hasCompanions = Boolean(
      primaryReason?.reason_code?.trim() &&
      primaryReason.reason_text?.trim() &&
      primaryReason.evidence_ref?.trim() &&
      primaryReason.next_action?.trim(),
    );
    if (!hasCompanions) {
      pushStopCondition(stopConditions, { code: "non_green_missing_reason_companions", scope: "read", source: "room_status_reasons" });
    }
  }

  if (normalizedStatus === "green" && PROOF_BOUND_ROOMS.has(room) && !summary.evidence_ref && !explicitExemptionCode) {
    pushStopCondition(stopConditions, { code: "green_proof_room_missing_evidence_or_exemption", scope: "read", source: "room_summary" });
  }

  if (room === "system") {
    if (runtime.runtimeMode === "primary_db") {
      const boundaryState = await queryOne<{
        owner_is_eoa: boolean;
        status: string;
      }>(
        `SELECT owner_is_eoa, status
           FROM system_boundary_state
          ORDER BY updated_at DESC
          LIMIT 1`,
      ).catch(() => null);

      if (!boundaryState) {
        pushStopCondition(stopConditions, { code: "boundary_state_unverified", scope: "write", source: "system_boundary_state" });
      } else {
        const statusValue = boundaryState.status.trim().toLowerCase();
        const boundaryVerified = statusValue === "verified" || statusValue === "green" || statusValue === "governed";
        if (!boundaryVerified) {
          pushStopCondition(stopConditions, { code: "boundary_state_unverified", scope: "write", source: "system_boundary_state" });
        }
        if (boundaryState.owner_is_eoa) {
          pushStopCondition(stopConditions, { code: "boundary_owner_still_eoa", scope: "write", source: "system_boundary_state" });
        }
      }

      const isolationRows = await query<{
        rootfs_read_only: boolean;
        dropped_caps: boolean;
        explicit_mounts_only: boolean;
        canary_status: string | null;
        rollback_proof_status: string | null;
      }>(
        `SELECT rootfs_read_only,
                dropped_caps,
                explicit_mounts_only,
                canary_status,
                rollback_proof_status
           FROM system_runtime_isolation`,
      ).catch(() => []);

      if (isolationRows.length === 0) {
        pushStopCondition(stopConditions, { code: "boundary_isolation_unverified", scope: "write", source: "system_runtime_isolation" });
        pushStopCondition(stopConditions, { code: "rollback_canary_unverified", scope: "write", source: "system_runtime_isolation" });
      } else {
        const isolationHardened = isolationRows.every((row) =>
          row.rootfs_read_only && row.dropped_caps && row.explicit_mounts_only,
        );
        if (!isolationHardened) {
          pushStopCondition(stopConditions, { code: "boundary_isolation_unverified", scope: "write", source: "system_runtime_isolation" });
        }

        const rolloutVerified = isolationRows.every((row) => {
          const canary = (row.canary_status ?? "").trim().toLowerCase();
          const rollback = (row.rollback_proof_status ?? "").trim().toLowerCase();
          const canaryOk = canary === "passed" || canary === "green" || canary === "verified";
          const rollbackOk = rollback === "passed" || rollback === "green" || rollback === "verified";
          return canaryOk && rollbackOk;
        });
        if (!rolloutVerified) {
          pushStopCondition(stopConditions, { code: "rollback_canary_unverified", scope: "write", source: "system_runtime_isolation" });
        }
      }
    }

    const summaryBlockers = Array.isArray(summary.summary_json?.["blockers"])
      ? summary.summary_json["blockers"] as string[]
      : [];
    if (summaryBlockers.includes("boundary_owner_still_eoa")) {
      pushStopCondition(stopConditions, { code: "boundary_owner_still_eoa", scope: "write", source: "system_summary" });
    }
  }

  if (room === "market") {
    const targetCount = Number(summary.summary_json?.["target_universe_count"] ?? 0);
    if (targetCount === 0) {
      pushStopCondition(stopConditions, { code: "target_registry_empty", scope: "write", source: "market_targets" });
      return stopConditions;
    }

    const latestIntelRaw = String(summary.summary_json?.["latest_intel_utc"] ?? "");
    const latestIntelMs = Date.parse(latestIntelRaw);
    const intelFreshWindowMs = 30 * 24 * 60 * 60 * 1000;
    const intelFresh = Number.isFinite(latestIntelMs) && Date.now() - latestIntelMs <= intelFreshWindowMs;
    if (!intelFresh) {
      pushStopCondition(stopConditions, { code: "market_intel_missing", scope: "write", source: "market_intel_rows" });
    }

    const sourceStatus = String(summary.summary_json?.["source_01_status"] ?? "disconnected").trim().toLowerCase();
    if (sourceStatus !== "connected") {
      pushStopCondition(stopConditions, { code: "market_source_disconnected", scope: "write", source: "market_sources" });
    }
  }

  if (room === "commercial") {
    const billingState: BillingVerificationState = {
      sourceType: normalizeBillingSourceType(
        typeof summary.summary_json?.["source_type"] === "string"
          ? summary.summary_json["source_type"] as string
          : null,
        {
          paypal: Boolean(parseBooleanLike(summary.summary_json?.["component_paypal"])),
          bankTransfer: Boolean(parseBooleanLike(summary.summary_json?.["component_bank_transfer"])),
          btcWallet: Boolean(parseBooleanLike(summary.summary_json?.["component_btc_wallet"])),
          ethWallet: Boolean(parseBooleanLike(summary.summary_json?.["component_eth_wallet"])),
        },
      ),
      components: {
        paypal: Boolean(parseBooleanLike(summary.summary_json?.["component_paypal"])),
        bankTransfer: Boolean(parseBooleanLike(summary.summary_json?.["component_bank_transfer"])),
        btcWallet: Boolean(parseBooleanLike(summary.summary_json?.["component_btc_wallet"])),
        ethWallet: Boolean(parseBooleanLike(summary.summary_json?.["component_eth_wallet"])),
      },
      isConnected: Boolean(parseBooleanLike(summary.summary_json?.["is_connected"])),
      isVerified: Boolean(parseBooleanLike(summary.summary_json?.["is_verified"])),
      verificationMethod:
        typeof summary.summary_json?.["verification_method"] === "string"
          ? summary.summary_json["verification_method"] as string
          : null,
      lastVerifiedAt:
        typeof summary.summary_json?.["last_verified_at"] === "string"
          ? summary.summary_json["last_verified_at"] as string
          : null,
      verifiedBy:
        typeof summary.summary_json?.["verified_by"] === "string"
          ? summary.summary_json["verified_by"] as string
          : null,
      evidenceRef:
        typeof summary.summary_json?.["billing_evidence_ref"] === "string"
          ? summary.summary_json["billing_evidence_ref"] as string
          : null,
      bankAccountLabel: null,
      bankRoutingLast4: null,
      bankAccountLast4: null,
    };

    if (!isBillingSourceLaunchVerified(billingState)) {
      pushStopCondition(stopConditions, { code: "billing_source_not_connected", scope: "write", source: "commercial_billing_summary" });
    }
    if (synthesized) {
      pushStopCondition(stopConditions, { code: "certificate_eligibility_unavailable_in_synthesized_mode", scope: "write", source: "synth_fallback" });
    }
  }

  return stopConditions;
}

function getPayloadString(payload: Record<string, unknown>, key: string): string | undefined {
  const raw = payload[key];
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value.length > 0 ? value : undefined;
}

function getPayloadBoolean(payload: Record<string, unknown>, key: string): boolean | undefined {
  const raw = payload[key];
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function getPayloadRecordArray(payload: Record<string, unknown>, key: string): Array<Record<string, unknown>> {
  const raw = payload[key];
  if (!Array.isArray(raw)) return [];
  const records: Array<Record<string, unknown>> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    records.push(entry as Record<string, unknown>);
  }
  return records;
}

function isVerifiedStatus(value: string | null | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "passed" || normalized === "verified" || normalized === "green";
}

function normalizeEvidenceRef(
  room: RoomKey,
  actionName: string,
  actionId: string,
  requestedBy: string,
  provided: string | null,
): string {
  if (provided && provided.trim().length > 0) return provided.trim();
  const actorPart = requestedBy.replaceAll(/[^a-zA-Z0-9_:-]/g, "_").slice(0, 24);
  return `evd_${room}_${actionName}_${actorPart}_${actionId.slice(0, 12)}`;
}

async function upsertRoomSummaryTx(
  client: PoolClient,
  room: RoomKey,
  patch: RoomSummaryPatch,
  evidenceRef: string,
  actor: string,
): Promise<void> {
  await client.query(
    `INSERT INTO room_summary
      (room_key, status_color, reason_code, reason_text, delta_summary, updated_at_utc, owner, evidence_ref, next_action, next_update_eta)
     VALUES
      ($1, $2, $3, $4, $5, now(), $6, $7, $8, now() + interval '30 minutes')
     ON CONFLICT (room_key) DO UPDATE
       SET status_color = EXCLUDED.status_color,
           reason_code = EXCLUDED.reason_code,
           reason_text = EXCLUDED.reason_text,
           delta_summary = EXCLUDED.delta_summary,
           updated_at_utc = EXCLUDED.updated_at_utc,
           owner = EXCLUDED.owner,
           evidence_ref = EXCLUDED.evidence_ref,
           next_action = EXCLUDED.next_action,
           next_update_eta = EXCLUDED.next_update_eta`,
    [
      room,
      normalizeStatus(patch.status),
      patch.reasonCode,
      patch.reasonText,
      patch.deltaSummary,
      ROOM_OWNER[room],
      evidenceRef,
      patch.nextAction,
    ],
  );

  if (patch.status !== "green" && patch.reasonCode && patch.reasonText) {
    await client.query(
      `INSERT INTO room_status_reasons (room_key, reason_code, reason_text, evidence_ref, created_at, created_by)
       VALUES ($1, $2, $3, $4, now(), $5)`,
      [room, patch.reasonCode, patch.reasonText, evidenceRef, actor],
    );
  }

  await client.query(
    `INSERT INTO room_change_events (room_key, event_type, event_payload, evidence_ref, created_at, created_by)
     VALUES ($1, 'room_summary_refreshed', $2::jsonb, $3, now(), $4)`,
    [
      room,
      JSON.stringify({
        status: normalizeStatus(patch.status),
        reasonCode: patch.reasonCode,
        deltaSummary: patch.deltaSummary,
      }),
      evidenceRef,
      actor,
    ],
  );
}

async function upsertIsolationStateTx(
  client: PoolClient,
  payload: Record<string, unknown>,
  override: { canaryStatus?: string; rollbackStatus?: string } = {},
): Promise<{
  serviceName: string;
  rootfsReadOnly: boolean;
  droppedCaps: boolean;
  explicitMountsOnly: boolean;
  canaryStatus: string;
  rollbackStatus: string;
}> {
  const serviceName = getPayloadString(payload, "serviceName") ?? "runtime-api";
  const existing = await client.query<{
    rootfs_read_only: boolean;
    dropped_caps: boolean;
    explicit_mounts_only: boolean;
    canary_status: string | null;
    rollback_proof_status: string | null;
  }>(
    `SELECT rootfs_read_only, dropped_caps, explicit_mounts_only, canary_status, rollback_proof_status
       FROM system_runtime_isolation
      WHERE service_name = $1`,
    [serviceName],
  );

  const row = existing.rows[0] ?? null;
  const rootfsReadOnly = getPayloadBoolean(payload, "rootfsReadOnly") ?? row?.rootfs_read_only ?? false;
  const droppedCaps = getPayloadBoolean(payload, "droppedCaps") ?? row?.dropped_caps ?? false;
  const explicitMountsOnly = getPayloadBoolean(payload, "explicitMountsOnly") ?? row?.explicit_mounts_only ?? false;
  const canaryStatus =
    override.canaryStatus ??
    getPayloadString(payload, "canaryStatus") ??
    row?.canary_status ??
    "unverified";
  const rollbackStatus =
    override.rollbackStatus ??
    getPayloadString(payload, "rollbackStatus") ??
    row?.rollback_proof_status ??
    "unverified";
  const seccompProfile = getPayloadString(payload, "seccompProfile") ?? "default";
  const apparmorProfile = getPayloadString(payload, "apparmorProfile") ?? "default";

  await client.query(
    `INSERT INTO system_runtime_isolation
      (service_name, rootfs_read_only, dropped_caps, explicit_mounts_only, seccomp_profile, apparmor_profile, canary_status, rollback_proof_status, updated_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, now())
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
      serviceName,
      rootfsReadOnly,
      droppedCaps,
      explicitMountsOnly,
      seccompProfile,
      apparmorProfile,
      canaryStatus,
      rollbackStatus,
    ],
  );

  const explicitServiceName = getPayloadString(payload, "serviceName");
  const applyToAllIsolationRows = getPayloadBoolean(payload, "applyToAllIsolationRows") ?? explicitServiceName === undefined;
  if (applyToAllIsolationRows) {
    await client.query(
      `UPDATE system_runtime_isolation
          SET rootfs_read_only = $1,
              dropped_caps = $2,
              explicit_mounts_only = $3,
              canary_status = $4,
              rollback_proof_status = $5,
              updated_at = now()
        WHERE service_name <> $6`,
      [rootfsReadOnly, droppedCaps, explicitMountsOnly, canaryStatus, rollbackStatus, serviceName],
    );
  }

  return {
    serviceName,
    rootfsReadOnly,
    droppedCaps,
    explicitMountsOnly,
    canaryStatus,
    rollbackStatus,
  };
}

async function applyRoomActionMutationTx(
  client: PoolClient,
  room: RoomKey,
  actionName: string,
  payload: Record<string, unknown>,
  context: RoomActionMutationContext,
): Promise<RoomActionMutationResult> {
  if (room === "commercial" && actionName === "sync_billing") {
    const [invoiceStatsResult, renewalsResult] = await Promise.all([
      client.query<{ open_count: string; paid_count: string; failed_count: string }>(
        `SELECT
            COUNT(*) FILTER (WHERE event_type IN ('invoice_issued','invoice_overdue'))::text AS open_count,
            COUNT(*) FILTER (WHERE event_type = 'invoice_paid')::text AS paid_count,
            COUNT(*) FILTER (WHERE event_type = 'invoice_failed')::text AS failed_count
           FROM billing_events`,
      ),
      client.query<{ renewal_count: string }>(
        `SELECT COUNT(*)::text AS renewal_count
           FROM calendar_events
          WHERE category = 'commercial'
            AND starts_at BETWEEN now() AND now() + interval '30 days'`,
      ),
    ]);

    const invoiceStats = invoiceStatsResult.rows[0];
    const renewals = renewalsResult.rows[0];
    const billing = buildBillingVerificationState(payload, context.requestedBy, context.evidenceRef);
    const failedCount = Number(invoiceStats?.failed_count ?? "0");
    const billingConnected = billing.isConnected;
    await client.query(
      `INSERT INTO commercial_billing_summary
        (
          billing_source,
          source_type,
          component_paypal,
          component_bank_transfer,
          component_btc_wallet,
          component_eth_wallet,
          is_connected,
          is_verified,
          verification_method,
          last_verified_at,
          verified_by,
          evidence_ref,
          bank_account_label,
          bank_routing_last4,
          bank_account_last4,
          invoice_count_open,
          invoice_count_paid,
          invoice_count_failed,
          renewals_due_30d,
          last_billing_sync_utc,
          updated_at
        )
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, now(), now())`,
      [
        billingConnected ? "connected" : "not_connected",
        billing.sourceType,
        billing.components.paypal,
        billing.components.bankTransfer,
        billing.components.btcWallet,
        billing.components.ethWallet,
        billing.isConnected,
        billing.isVerified,
        billing.verificationMethod,
        billing.lastVerifiedAt,
        billing.verifiedBy,
        billing.evidenceRef,
        billing.bankAccountLabel,
        billing.bankRoutingLast4,
        billing.bankAccountLast4,
        Number(invoiceStats?.open_count ?? "0"),
        Number(invoiceStats?.paid_count ?? "0"),
        failedCount,
        Number(renewals?.renewal_count ?? "0"),
      ],
    );

    const billingVerifiedForLaunch = isBillingSourceLaunchVerified(billing);
    const status: RoomStatus = billingVerifiedForLaunch && failedCount === 0 ? "green" : "amber";
    const reasonCode = !billingVerifiedForLaunch
      ? "billing_source_not_connected"
      : failedCount > 0
        ? "failed_payments_present"
        : null;
    const reasonText = !billingVerifiedForLaunch
      ? "Billing source is not verified under hybrid/manual_attested policy."
      : failedCount > 0
        ? "Failed payments are present in billing events."
        : null;

    return {
      domainWrites: ["commercial_billing_summary"],
      summaryPatch: {
        status,
        reasonCode,
        reasonText,
        deltaSummary: "billing_synced",
        nextAction: status === "green" ? null : "sync_billing",
      },
    };
  }

  if (room === "commercial" && actionName === "refresh_entitlements") {
    const workspacesResult = await client.query<{ id: string; plan: string }>(
      "SELECT id, plan FROM workspaces",
    );
    let entitledCount = 0;
    for (const workspace of workspacesResult.rows) {
      const certificateEntitled = workspace.plan !== "free";
      if (certificateEntitled) entitledCount += 1;
      await client.query(
        `INSERT INTO commercial_entitlements
          (license_id, plan_name, certificate_entitled, evidence_entitled, market_tier, monthly_cap, status, updated_at)
         VALUES
          ($1, $2, $3, true, $4, $5, 'active', now())
         ON CONFLICT (license_id) DO UPDATE
           SET plan_name = EXCLUDED.plan_name,
               certificate_entitled = EXCLUDED.certificate_entitled,
               evidence_entitled = EXCLUDED.evidence_entitled,
               market_tier = EXCLUDED.market_tier,
               monthly_cap = EXCLUDED.monthly_cap,
               status = EXCLUDED.status,
               updated_at = now()`,
        [
          `workspace:${workspace.id}`,
          workspace.plan,
          certificateEntitled,
          workspace.plan,
          workspace.plan === "free" ? 3 : workspace.plan === "solo" ? 25 : workspace.plan === "business" ? 250 : 500,
        ],
      );
    }

    return {
      domainWrites: ["commercial_entitlements"],
      summaryPatch: {
        status: entitledCount > 0 ? "green" : "amber",
        reasonCode: entitledCount > 0 ? null : "certificate_entitlements_unavailable",
        reasonText: entitledCount > 0 ? null : "No certificate-entitled workspace found in persisted entitlements.",
        deltaSummary: "entitlements_refreshed",
        nextAction: entitledCount > 0 ? null : "refresh_entitlements",
      },
    };
  }

  if (room === "commercial" && actionName === "issue_certificate") {
    const domainWrites = new Set<string>();
    const nowUtc = new Date().toISOString();

    const requestedLicenseId =
      getPayloadString(payload, "licenseId") ??
      getPayloadString(payload, "license_id") ??
      getPayloadString(payload, "license") ??
      null;

    const entitlement = await client.query<{
      license_id: string;
      plan_name: string;
      certificate_entitled: boolean;
    }>(
      `SELECT license_id, plan_name, certificate_entitled
         FROM commercial_entitlements
        WHERE certificate_entitled = true
        ORDER BY updated_at DESC
        LIMIT 1`,
    ).then((res) => res.rows[0] ?? null).catch(() => null);

    let licenseId = requestedLicenseId ?? entitlement?.license_id ?? null;
    let planName = entitlement?.plan_name ?? null;

    if (!licenseId) {
      const workspace = await client.query<{ id: string; plan: string }>(
        "SELECT id, plan FROM workspaces ORDER BY created_at ASC LIMIT 1",
      ).then((res) => res.rows[0] ?? null).catch(() => null);

      if (workspace) {
        licenseId = `workspace:${workspace.id}`;
        planName = workspace.plan;
        await client.query(
          `INSERT INTO commercial_entitlements
            (license_id, plan_name, certificate_entitled, evidence_entitled, market_tier, monthly_cap, status, updated_at)
           VALUES
            ($1, $2, $3, true, $4, $5, 'active', now())
           ON CONFLICT (license_id) DO UPDATE
             SET plan_name = EXCLUDED.plan_name,
                 certificate_entitled = EXCLUDED.certificate_entitled,
                 evidence_entitled = EXCLUDED.evidence_entitled,
                 market_tier = EXCLUDED.market_tier,
                 monthly_cap = EXCLUDED.monthly_cap,
                 status = EXCLUDED.status,
                 updated_at = now()`,
          [
            licenseId,
            workspace.plan,
            workspace.plan !== "free",
            workspace.plan,
            workspace.plan === "free" ? 3 : workspace.plan === "solo" ? 25 : workspace.plan === "business" ? 250 : 500,
          ],
        );
        domainWrites.add("commercial_entitlements");
      }
    }

    if (!licenseId) {
      return {
        domainWrites: [],
        summaryPatch: {
          status: "amber",
          reasonCode: "certificate_entitlements_unavailable",
          reasonText: "No license_id provided and no certificate-entitled workspace entitlement is present.",
          deltaSummary: "certificate_issue_blocked",
          nextAction: "refresh_entitlements",
        },
      };
    }

    // Billing verification state (best-effort); certificate issuance itself is evidence-backed, but we still
    // surface readiness truth in the room summary.
    const billingRow = await client.query<{
      source_type: string;
      component_paypal: boolean;
      component_bank_transfer: boolean;
      component_btc_wallet: boolean;
      component_eth_wallet: boolean;
      is_connected: boolean;
      is_verified: boolean;
      verification_method: string | null;
      last_verified_at: string | null;
      verified_by: string | null;
      evidence_ref: string | null;
      bank_account_label: string | null;
      bank_routing_last4: string | null;
      bank_account_last4: string | null;
    }>(
      `SELECT source_type,
              component_paypal,
              component_bank_transfer,
              component_btc_wallet,
              component_eth_wallet,
              is_connected,
              is_verified,
              verification_method,
              last_verified_at::text AS last_verified_at,
              verified_by,
              evidence_ref,
              bank_account_label,
              bank_routing_last4,
              bank_account_last4
         FROM commercial_billing_summary
        ORDER BY updated_at DESC
        LIMIT 1`,
    ).then((res) => res.rows[0] ?? null).catch(() => null);

    const billingState: BillingVerificationState = {
      sourceType: normalizeBillingSourceType(billingRow?.source_type ?? null, {
        paypal: Boolean(billingRow?.component_paypal),
        bankTransfer: Boolean(billingRow?.component_bank_transfer),
        btcWallet: Boolean(billingRow?.component_btc_wallet),
        ethWallet: Boolean(billingRow?.component_eth_wallet),
      }),
      components: {
        paypal: Boolean(billingRow?.component_paypal),
        bankTransfer: Boolean(billingRow?.component_bank_transfer),
        btcWallet: Boolean(billingRow?.component_btc_wallet),
        ethWallet: Boolean(billingRow?.component_eth_wallet),
      },
      isConnected: Boolean(billingRow?.is_connected),
      isVerified: Boolean(billingRow?.is_verified),
      verificationMethod: billingRow?.verification_method ?? null,
      lastVerifiedAt: billingRow?.last_verified_at ?? null,
      verifiedBy: billingRow?.verified_by ?? null,
      evidenceRef: billingRow?.evidence_ref ?? null,
      bankAccountLabel: billingRow?.bank_account_label ?? null,
      bankRoutingLast4: billingRow?.bank_routing_last4 ?? null,
      bankAccountLast4: billingRow?.bank_account_last4 ?? null,
    };
    const billingReady = isBillingSourceLaunchVerified(billingState);

    const certificateId = `cert_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
    const payloadForHash = {
      certificateId,
      licenseId,
      planName,
      issuer: context.requestedBy,
      issuedAtUtc: nowUtc,
      evidenceRef: context.evidenceRef,
    };
    const payloadHash = createHash("sha256").update(JSON.stringify(payloadForHash)).digest("hex");

    await client.query(
      `INSERT INTO commercial_certificates
        (certificate_id, license_id, issuer, status, evidence_ref, payload_hash, tx_hash, issued_at_utc, created_at)
       VALUES
        ($1, $2, $3, 'issued', $4, $5, null, now(), now())`,
      [certificateId, licenseId, context.requestedBy, context.evidenceRef, payloadHash],
    );
    domainWrites.add("commercial_certificates");

    const status: RoomStatus = billingReady ? "green" : "amber";
    return {
      domainWrites: Array.from(domainWrites),
      summaryPatch: {
        status,
        reasonCode: billingReady ? null : "billing_source_not_connected",
        reasonText: billingReady ? null : "Billing source is not verified under hybrid/manual_attested policy.",
        deltaSummary: "certificate_issued",
        nextAction: billingReady ? null : "sync_billing",
      },
    };
  }

  if (room === "commercial" && actionName === "revoke_certificate") {
    const requestedCertificateId =
      getPayloadString(payload, "certificateId") ??
      getPayloadString(payload, "certificate_id") ??
      null;

    const row = requestedCertificateId
      ? { certificate_id: requestedCertificateId }
      : await client.query<{ certificate_id: string }>(
          `SELECT certificate_id
             FROM commercial_certificates
            ORDER BY issued_at_utc DESC
            LIMIT 1`,
        ).then((res) => res.rows[0] ?? null).catch(() => null);

    if (!row?.certificate_id) {
      return {
        domainWrites: [],
        summaryPatch: {
          status: "amber",
          reasonCode: "certificate_not_found",
          reasonText: "No commercial certificate row exists to revoke.",
          deltaSummary: "certificate_revoke_blocked",
          nextAction: "issue_certificate",
        },
      };
    }

    await client.query(
      `UPDATE commercial_certificates
          SET status = 'revoked'
        WHERE certificate_id = $1`,
      [row.certificate_id],
    );

    return {
      domainWrites: ["commercial_certificates"],
      summaryPatch: {
        status: "amber",
        reasonCode: "certificate_revoked",
        reasonText: `Certificate ${row.certificate_id} is revoked.`,
        deltaSummary: "certificate_revoked",
        nextAction: "issue_certificate",
      },
    };
  }

  if (room === "commercial" && actionName === "export_commercial_record") {
    const nowUtc = new Date().toISOString();
    const exportRoot = path.join(ENV.evidenceDir, "journal", "exports", "commercial");
    const safeRef = context.evidenceRef.replaceAll(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
    const exportPath = path.join(exportRoot, `${nowUtc.slice(0, 10)}_${safeRef}.json`);

    const [billing, entitlements, certificates] = await Promise.all([
      client.query(
        `SELECT *
           FROM commercial_billing_summary
          ORDER BY updated_at DESC
          LIMIT 5`,
      ),
      client.query(
        `SELECT license_id,
                plan_name,
                certificate_entitled,
                evidence_entitled,
                market_tier,
                monthly_cap,
                status,
                updated_at::text AS updated_at
           FROM commercial_entitlements
          ORDER BY updated_at DESC
          LIMIT 50`,
      ),
      client.query(
        `SELECT certificate_id,
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
          LIMIT 50`,
      ),
    ]);

    await mkdir(exportRoot, { recursive: true });
    await writeFile(
      exportPath,
      JSON.stringify(
        {
          room: "commercial",
          export_type: "commercial_record",
          exported_at_utc: nowUtc,
          requested_by: context.requestedBy,
          evidence_ref: context.evidenceRef,
          billing_summary: billing.rows,
          entitlements: entitlements.rows,
          certificates: certificates.rows,
        },
        null,
        2,
      ),
      "utf-8",
    );

    await client.query(
      `INSERT INTO evidence_exports (customer_id, scope, export_path, created_at)
       VALUES (null, $1, $2, now())`,
      [JSON.stringify({ room: "commercial", exportType: "commercial_record", evidenceRef: context.evidenceRef }), exportPath],
    );

    const licenseCount = entitlements.rows.length;
    const certCount = certificates.rows.length;
    const status: RoomStatus = licenseCount > 0 && certCount > 0 ? "green" : "amber";
    const reasonCode = licenseCount === 0 ? "license_objects_missing" : certCount === 0 ? "certificate_objects_missing" : null;
    const reasonText =
      licenseCount === 0
        ? "No persisted license object exists yet."
        : certCount === 0
          ? "No persisted commercial certificate exists yet."
          : null;

    return {
      domainWrites: ["evidence_exports"],
      summaryPatch: {
        status,
        reasonCode,
        reasonText,
        deltaSummary: "commercial_record_exported",
        nextAction: status === "green" ? null : licenseCount === 0 ? "refresh_entitlements" : "issue_certificate",
      },
    };
  }

  if (room === "camp" && actionName === "refresh_identity") {
    const protocolName = getPayloadString(payload, "protocol_name") ?? getPayloadString(payload, "protocolName") ?? "VYRDON";
    const systemName = getPayloadString(payload, "system_name") ?? getPayloadString(payload, "systemName") ?? "VYRDX execution runtime";
    const executionModel = getPayloadString(payload, "execution_model") ?? getPayloadString(payload, "executionModel") ?? "governed_execution_runtime";
    const sealPolicy = getPayloadString(payload, "seal_policy") ?? getPayloadString(payload, "sealPolicy") ?? "evidence_before_execution";

    await client.query(
      `INSERT INTO camp_identity (protocol_name, system_name, execution_model, seal_policy, updated_at)
       VALUES ($1, $2, $3, $4, now())`,
      [protocolName, systemName, executionModel, sealPolicy],
    );

    return {
      domainWrites: ["camp_identity"],
      summaryPatch: {
        status: "green",
        reasonCode: null,
        reasonText: null,
        deltaSummary: "identity_refreshed",
        nextAction: null,
      },
    };
  }

  if (room === "camp" && actionName === "refresh_readme") {
    const readme =
      getPayloadString(payload, "README") ??
      getPayloadString(payload, "readme") ??
      getPayloadString(payload, "paragraph") ??
      "VYRDX is the human-implemented execution runtime of VYRDON. Camp defines the entry doctrine for authority, trust, contact routing, and coordination before any governed room is entered.";
    const injectionRaw = payload["code_injection"] ?? payload["codeInjection"] ?? {};
    const injection =
      injectionRaw && typeof injectionRaw === "object" && !Array.isArray(injectionRaw)
        ? injectionRaw as Record<string, unknown>
        : {};

    await client.query(
      `INSERT INTO camp_readme (paragraph, code_injection, updated_at)
       VALUES ($1, $2, now())`,
      [readme, JSON.stringify(injection)],
    );

    return {
      domainWrites: ["camp_readme"],
      summaryPatch: {
        status: "green",
        reasonCode: null,
        reasonText: null,
        deltaSummary: "readme_refreshed",
        nextAction: null,
      },
    };
  }

  if (room === "camp" && actionName === "refresh_contact") {
    const contactRecords = getPayloadRecordArray(payload, "contacts");
    const operationsEmail = getPayloadString(payload, "operations_email") ?? getPayloadString(payload, "operationsEmail") ?? null;
    const authorityEmail = getPayloadString(payload, "authority_email") ?? getPayloadString(payload, "authorityEmail") ?? null;
    const fallback: Array<{ contact_role: string; email: string }> = [];
    if (operationsEmail) fallback.push({ contact_role: "operations", email: operationsEmail });
    if (authorityEmail) fallback.push({ contact_role: "authority", email: authorityEmail });

    const contacts = contactRecords.length > 0
      ? contactRecords
      : fallback;

    let writeCount = 0;
    for (const record of contacts) {
      const role = getPayloadString(record, "contact_role") ?? getPayloadString(record, "role");
      const email = getPayloadString(record, "email");
      if (!role || !email) continue;
      await client.query(
        `INSERT INTO camp_contacts (contact_role, email, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (contact_role) DO UPDATE
           SET email = EXCLUDED.email,
               updated_at = now()`,
        [role.toLowerCase(), email],
      );
      writeCount += 1;
    }

    return {
      domainWrites: writeCount > 0 ? ["camp_contacts"] : [],
      summaryPatch: {
        status: writeCount > 0 ? "green" : "amber",
        reasonCode: writeCount > 0 ? null : "camp_contact_missing",
        reasonText: writeCount > 0 ? null : "No contact rows provided (operations/authority).",
        deltaSummary: "contact_refreshed",
        nextAction: writeCount > 0 ? null : "refresh_contact",
      },
    };
  }

  if (room === "camp" && actionName === "refresh_licenses") {
    const licenseRecords = getPayloadRecordArray(payload, "licenses");
    const licenses =
      licenseRecords.length > 0
        ? licenseRecords
        : [
            {
              license_name: "VYRDON Execution Protocol",
              license_scope: "runtime",
              license_status: "active",
              display_order: 1,
            },
          ];

    await client.query("DELETE FROM camp_licenses");
    let order = 1;
    for (const record of licenses) {
      const name = getPayloadString(record, "license_name") ?? getPayloadString(record, "name") ?? `license_${order}`;
      const scope = getPayloadString(record, "license_scope") ?? getPayloadString(record, "scope") ?? "runtime";
      const status = getPayloadString(record, "license_status") ?? getPayloadString(record, "status") ?? "active";
      const displayOrderRaw = record["display_order"] ?? record["displayOrder"];
      let displayOrder = order;
      if (typeof displayOrderRaw === "number" && Number.isFinite(displayOrderRaw)) {
        displayOrder = displayOrderRaw;
      } else if (typeof displayOrderRaw === "string") {
        const parsed = Number(displayOrderRaw.trim());
        if (Number.isFinite(parsed)) displayOrder = parsed;
      }

      await client.query(
        `INSERT INTO camp_licenses (license_name, license_scope, license_status, display_order, updated_at)
         VALUES ($1, $2, $3, $4, now())`,
        [name, scope, status, displayOrder],
      );
      order += 1;
    }

    return {
      domainWrites: ["camp_licenses"],
      summaryPatch: {
        status: "green",
        reasonCode: null,
        reasonText: null,
        deltaSummary: "licenses_refreshed",
        nextAction: null,
      },
    };
  }

  if (room === "market" && actionName === "refresh_targets") {
    const defaultSourceName = getPayloadString(payload, "sourceName") ?? "target_market_registry";
    const targetRecords = getPayloadRecordArray(payload, "targets");
    const domainWrites = new Set<string>();

    // Always deprecate legacy crypto-feed targets in favor of target-market intelligence.
    await client.query(
      `UPDATE market_targets
          SET is_active = false,
              updated_at = now()
        WHERE source_name = 'coingecko'
          AND is_active = true`,
    );

    for (const record of targetRecords) {
      const rawSymbol = getPayloadString(record, "symbol") ?? getPayloadString(record, "id");
      if (!rawSymbol) continue;
      const symbol = rawSymbol.trim().toUpperCase();

      const displayName =
        getPayloadString(record, "display_name") ??
        getPayloadString(record, "displayName") ??
        getPayloadString(record, "name") ??
        symbol;
      const sourceName =
        getPayloadString(record, "source_name") ??
        getPayloadString(record, "sourceName") ??
        defaultSourceName;
      const isActive = getPayloadBoolean(record, "is_active") ?? getPayloadBoolean(record, "isActive") ?? true;

      const metadataValue = record["metadata"];
      const metadata: Record<string, unknown> =
        metadataValue && typeof metadataValue === "object" && !Array.isArray(metadataValue)
          ? { ...(metadataValue as Record<string, unknown>) }
          : {};
      const sector = getPayloadString(record, "sector");
      const region = getPayloadString(record, "region");
      const stage = getPayloadString(record, "stage");
      const priority = getPayloadString(record, "priority");
      if (sector) metadata["sector"] = sector;
      if (region) metadata["region"] = region;
      if (stage) metadata["stage"] = stage;
      if (priority) metadata["priority"] = priority;

      await client.query(
        `INSERT INTO market_targets (symbol, display_name, source_name, is_active, metadata, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (symbol) DO UPDATE
           SET display_name = EXCLUDED.display_name,
               source_name = EXCLUDED.source_name,
               is_active = EXCLUDED.is_active,
               metadata = market_targets.metadata || EXCLUDED.metadata,
               updated_at = now()`,
        [symbol, displayName, sourceName, isActive, JSON.stringify(metadata)],
      );
      domainWrites.add("market_targets");
    }

    const statsResult = await client.query<{ target_count: string; intel_30d: string }>(
      `SELECT
          COUNT(*) FILTER (WHERE is_active = true AND source_name <> 'coingecko')::text AS target_count,
          (SELECT COUNT(*)::text FROM market_intel_rows WHERE captured_at > now() - interval '30 days') AS intel_30d
       FROM market_targets`,
    );
    const stats = statsResult.rows[0];
    const targetCount = Number(stats?.target_count ?? "0");
    const intel30d = Number(stats?.intel_30d ?? "0");
    const healthy = targetCount > 0 && intel30d > 0;
    const status: RoomStatus = healthy ? "green" : "amber";
    const reasonCode = targetCount === 0 ? "target_registry_empty" : intel30d === 0 ? "market_intel_missing" : null;
    const reasonText =
      targetCount === 0
        ? "Target market registry is empty. Persist at least one target entity."
        : intel30d === 0
          ? "No source-backed intelligence rows recorded in the last 30 days."
          : null;

    return {
      domainWrites: Array.from(domainWrites),
      summaryPatch: {
        status,
        reasonCode,
        reasonText,
        deltaSummary: "targets_refreshed",
        nextAction: healthy ? null : targetCount === 0 ? "refresh_targets" : "refresh_market_sources",
      },
    };
  }

  if (room === "market" && actionName === "refresh_market_sources") {
    const domainWrites = new Set<string>();

    // Upsert source definitions (optional)
    const sources = getPayloadRecordArray(payload, "sources");
    const fallbackSourceName = getPayloadString(payload, "sourceName") ?? "target_market_registry";
    const fallbackBaseUrl =
      getPayloadString(payload, "baseUrl") ??
      getPayloadString(payload, "sourceBaseUrl") ??
      getPayloadString(payload, "researchSourceUrl") ??
      "manual";
    const fallbackStatus = getPayloadString(payload, "status") ?? "connected";
    const fallbackLastError = getPayloadString(payload, "lastError") ?? null;

    const sourceRecords = sources.length > 0 ? sources : [{ sourceName: fallbackSourceName, baseUrl: fallbackBaseUrl, status: fallbackStatus, lastError: fallbackLastError }];
    for (const record of sourceRecords) {
      const sourceName = getPayloadString(record, "source_name") ?? getPayloadString(record, "sourceName") ?? fallbackSourceName;
      const statusValue = getPayloadString(record, "status") ?? fallbackStatus;
      const baseUrl = getPayloadString(record, "base_url") ?? getPayloadString(record, "baseUrl") ?? getPayloadString(record, "sourceBaseUrl") ?? fallbackBaseUrl;
      const lastError = getPayloadString(record, "last_error") ?? getPayloadString(record, "lastError") ?? fallbackLastError;

      if (!sourceName) continue;
      await client.query(
        `INSERT INTO market_sources (source_name, status, base_url, last_sync_utc, last_error, updated_at)
         VALUES ($1, $2, $3, now(), $4, now())
         ON CONFLICT (source_name) DO UPDATE
           SET status = EXCLUDED.status,
               base_url = EXCLUDED.base_url,
               last_sync_utc = EXCLUDED.last_sync_utc,
               last_error = EXCLUDED.last_error,
               updated_at = now()`,
        [sourceName, statusValue, baseUrl, lastError],
      );
      domainWrites.add("market_sources");
    }

    // Append intelligence rows (optional)
    const intelRows = getPayloadRecordArray(payload, "intel_rows").concat(getPayloadRecordArray(payload, "intelRows"));
    for (const record of intelRows) {
      const rawSymbol = getPayloadString(record, "symbol") ?? getPayloadString(record, "target") ?? getPayloadString(record, "entity");
      const headline = getPayloadString(record, "headline") ?? getPayloadString(record, "title");
      if (!rawSymbol || !headline) continue;
      const symbol = rawSymbol.trim().toUpperCase();

      // Ensure target exists (fail-closed: no orphan intelligence rows).
      const displayName =
        getPayloadString(record, "display_name") ??
        getPayloadString(record, "displayName") ??
        getPayloadString(record, "name") ??
        symbol;
      await client.query(
        `INSERT INTO market_targets (symbol, display_name, source_name, is_active, metadata, updated_at)
         VALUES ($1, $2, $3, true, '{}'::jsonb, now())
         ON CONFLICT (symbol) DO UPDATE
           SET display_name = EXCLUDED.display_name,
               is_active = true,
               updated_at = now()`,
        [symbol, displayName, fallbackSourceName],
      );
      domainWrites.add("market_targets");

      const sourceName = getPayloadString(record, "source_name") ?? getPayloadString(record, "source") ?? fallbackSourceName;
      const url = getPayloadString(record, "url") ?? null;
      const signalType = getPayloadString(record, "signal_type") ?? getPayloadString(record, "signalType") ?? "intel";
      const sentiment = getPayloadString(record, "sentiment") ?? "neutral";
      const impactScoreRaw = record["impact_score"] ?? record["impactScore"];
      let impactScore: number | null = null;
      if (typeof impactScoreRaw === "number" && Number.isFinite(impactScoreRaw)) {
        impactScore = Math.round(impactScoreRaw);
      } else if (typeof impactScoreRaw === "string") {
        const parsed = Number(impactScoreRaw.trim());
        impactScore = Number.isFinite(parsed) ? parsed : null;
      }
      const notes = getPayloadString(record, "notes") ?? null;
      const capturedAt = parseIsoOrNull(getPayloadString(record, "captured_at") ?? getPayloadString(record, "capturedAt") ?? null);

      await client.query(
        `INSERT INTO market_intel_rows
          (symbol, source_name, headline, url, signal_type, sentiment, impact_score, captured_at, notes, raw)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()), $9, $10)`,
        [
          symbol,
          sourceName,
          headline,
          url,
          signalType,
          sentiment,
          impactScore,
          capturedAt,
          notes,
          JSON.stringify(record),
        ],
      );
      domainWrites.add("market_intel_rows");
    }

    // Upsert competitor links (optional)
    const competitorRows = getPayloadRecordArray(payload, "competitors");
    for (const record of competitorRows) {
      const rawSymbol = getPayloadString(record, "symbol");
      const rawCompetitor = getPayloadString(record, "competitor_symbol") ?? getPayloadString(record, "competitorSymbol");
      if (!rawSymbol || !rawCompetitor) continue;
      const symbol = rawSymbol.trim().toUpperCase();
      const competitorSymbol = rawCompetitor.trim().toUpperCase();
      const relation = getPayloadString(record, "relation") ?? "competitor";

      // Ensure both targets exist.
      await client.query(
        `INSERT INTO market_targets (symbol, display_name, source_name, is_active, metadata, updated_at)
         VALUES ($1, $1, $2, true, '{}'::jsonb, now())
         ON CONFLICT (symbol) DO NOTHING`,
        [symbol, fallbackSourceName],
      );
      await client.query(
        `INSERT INTO market_targets (symbol, display_name, source_name, is_active, metadata, updated_at)
         VALUES ($1, $1, $2, true, '{}'::jsonb, now())
         ON CONFLICT (symbol) DO NOTHING`,
        [competitorSymbol, fallbackSourceName],
      );
      domainWrites.add("market_targets");

      await client.query(
        `INSERT INTO market_competitors (symbol, competitor_symbol, relation, created_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (symbol, competitor_symbol) DO UPDATE
           SET relation = EXCLUDED.relation`,
        [symbol, competitorSymbol, relation],
      );
      domainWrites.add("market_competitors");
    }

    const statsResult = await client.query<{ target_count: string; intel_30d: string }>(
      `SELECT
          COUNT(*) FILTER (WHERE is_active = true AND source_name <> 'coingecko')::text AS target_count,
          (SELECT COUNT(*)::text FROM market_intel_rows WHERE captured_at > now() - interval '30 days') AS intel_30d
       FROM market_targets`,
    );
    const stats = statsResult.rows[0];
    const targetCount = Number(stats?.target_count ?? "0");
    const intel30d = Number(stats?.intel_30d ?? "0");
    const healthy = targetCount > 0 && intel30d > 0;
    const status: RoomStatus = healthy ? "green" : "amber";
    const reasonCode = targetCount === 0 ? "target_registry_empty" : intel30d === 0 ? "market_intel_missing" : null;
    const reasonText =
      targetCount === 0
        ? "Target market registry is empty. Persist at least one target entity."
        : intel30d === 0
          ? "No source-backed intelligence rows recorded in the last 30 days."
          : null;

    return {
      domainWrites: Array.from(domainWrites),
      summaryPatch: {
        status,
        reasonCode,
        reasonText,
        deltaSummary: "market_sources_refreshed",
        nextAction: healthy ? null : targetCount === 0 ? "refresh_targets" : "refresh_market_sources",
      },
    };
  }

  if (room === "market" && actionName === "export_market_snapshot") {
    const nowUtc = new Date().toISOString();
    const exportRoot = path.join(ENV.evidenceDir, "journal", "exports", "market");
    const safeRef = context.evidenceRef.replaceAll(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
    const exportPath = path.join(exportRoot, `${nowUtc.slice(0, 10)}_${safeRef}.json`);

    const [sources, targets, intelRows, competitors] = await Promise.all([
      client.query<{
        source_name: string;
        status: string;
        base_url: string | null;
        last_sync_utc: string | null;
        last_error: string | null;
        updated_at: string;
      }>(
        `SELECT source_name,
                status,
                base_url,
                last_sync_utc::text AS last_sync_utc,
                last_error,
                updated_at::text AS updated_at
           FROM market_sources
          WHERE source_name <> 'coingecko'
          ORDER BY updated_at DESC
          LIMIT 20`,
      ),
      client.query<{
        symbol: string;
        display_name: string;
        source_name: string;
        is_active: boolean;
        metadata: Record<string, unknown>;
        updated_at: string;
      }>(
        `SELECT symbol,
                display_name,
                source_name,
                is_active,
                metadata,
                updated_at::text AS updated_at
           FROM market_targets
          WHERE source_name <> 'coingecko'
          ORDER BY updated_at DESC
          LIMIT 200`,
      ),
      client.query<{
        symbol: string;
        source_name: string;
        headline: string;
        url: string | null;
        signal_type: string;
        sentiment: string;
        impact_score: number | null;
        captured_at: string;
        notes: string | null;
      }>(
        `SELECT symbol,
                source_name,
                headline,
                url,
                signal_type,
                sentiment,
                impact_score,
                captured_at::text AS captured_at,
                notes
           FROM market_intel_rows
          ORDER BY captured_at DESC
          LIMIT 500`,
      ),
      client.query<{
        symbol: string;
        competitor_symbol: string;
        relation: string;
        created_at: string;
      }>(
        `SELECT symbol,
                competitor_symbol,
                relation,
                created_at::text AS created_at
           FROM market_competitors
          ORDER BY created_at DESC
          LIMIT 500`,
      ),
    ]);

    await mkdir(exportRoot, { recursive: true });
    await writeFile(
      exportPath,
      JSON.stringify(
        {
          room: "market",
          export_type: "market_snapshot",
          exported_at_utc: nowUtc,
          requested_by: context.requestedBy,
          evidence_ref: context.evidenceRef,
          sources: sources.rows,
          targets: targets.rows,
          intel_rows: intelRows.rows,
          competitors: competitors.rows,
        },
        null,
        2,
      ),
      "utf-8",
    );

    await client.query(
      `INSERT INTO evidence_exports (customer_id, scope, export_path, created_at)
       VALUES (null, $1, $2, now())`,
      [JSON.stringify({ room: "market", exportType: "market_snapshot", evidenceRef: context.evidenceRef }), exportPath],
    );

    const statsResult = await client.query<{ target_count: string; intel_30d: string }>(
      `SELECT
          COUNT(*) FILTER (WHERE is_active = true AND source_name <> 'coingecko')::text AS target_count,
          (SELECT COUNT(*)::text FROM market_intel_rows WHERE captured_at > now() - interval '30 days') AS intel_30d
       FROM market_targets`,
    );
    const stats = statsResult.rows[0];
    const targetCount = Number(stats?.target_count ?? "0");
    const intel30d = Number(stats?.intel_30d ?? "0");
    const healthy = targetCount > 0 && intel30d > 0;
    const status: RoomStatus = healthy ? "green" : "amber";
    const reasonCode = targetCount === 0 ? "target_registry_empty" : intel30d === 0 ? "market_intel_missing" : null;
    const reasonText =
      targetCount === 0
        ? "Target market registry is empty. Persist at least one target entity."
        : intel30d === 0
          ? "No source-backed intelligence rows recorded in the last 30 days."
          : null;

    return {
      domainWrites: ["evidence_exports"],
      summaryPatch: {
        status,
        reasonCode,
        reasonText,
        deltaSummary: "market_snapshot_exported",
        nextAction: healthy ? null : targetCount === 0 ? "refresh_targets" : "refresh_market_sources",
      },
    };
  }

  if (room === "system" && actionName === "refresh_boundary_state") {
    const boundaryOwner =
      getPayloadString(payload, "boundaryOwner") ??
      process.env.BOUNDARY_OWNER_ADDRESS ??
      process.env.BOUNDARY_V2_ADDRESS ??
      process.env.SAFE_ADDRESS ??
      "unknown";
    const timelockAddress = getPayloadString(payload, "timelockAddress") ?? process.env.TIMELOCK_ADDRESS ?? null;
    const guardianAddress = getPayloadString(payload, "guardianAddress") ?? process.env.GUARDIAN_ADDRESS ?? null;
    const ownerIsEoa = getPayloadBoolean(payload, "ownerIsEoa") ?? (process.env.BOUNDARY_OWNER_IS_EOA === "true");
    const status = !ownerIsEoa && Boolean(timelockAddress) && Boolean(guardianAddress) ? "verified" : "unverified";

    await client.query(
      `INSERT INTO system_boundary_state
        (boundary_owner, boundary_admin, timelock_address, guardian_address, owner_is_eoa, status, evidence_ref, updated_at)
       VALUES
        ($1, $2, $3, $4, $5, $6, null, now())`,
      [boundaryOwner, process.env.SAFE_ADDRESS ?? null, timelockAddress, guardianAddress, ownerIsEoa, status],
    );

    return {
      domainWrites: ["system_boundary_state"],
      summaryPatch: {
        status: status === "verified" ? "green" : "amber",
        reasonCode: status === "verified" ? null : "boundary_state_unverified",
        reasonText: status === "verified" ? null : "Boundary owner/timelock/guardian state is not fully verified.",
        deltaSummary: "boundary_state_refreshed",
        nextAction: status === "verified" ? null : "refresh_boundary_state",
      },
    };
  }

  if ((room === "system" && actionName === "refresh_trust_closure") || (room === "system" && actionName === "refresh_attestation")) {
    const componentName = getPayloadString(payload, "componentName") ?? "authority_plane";
    const attestationStatus =
      getPayloadString(payload, "attestationStatus") ??
      (process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET ? "valid" : "invalid");
    await client.query(
      `INSERT INTO system_attestation (component_name, status, token_expires_at, last_verified_at, last_error, updated_at)
       VALUES ($1, $2, null, now(), $3, now())`,
      [componentName, attestationStatus, attestationStatus === "valid" ? null : "attestation_not_verified"],
    );
    const isolation = await upsertIsolationStateTx(client, payload);
    const hardened = isolation.rootfsReadOnly && isolation.droppedCaps && isolation.explicitMountsOnly;
    const rolloutReady = isVerifiedStatus(isolation.canaryStatus) && isVerifiedStatus(isolation.rollbackStatus);
    return {
      domainWrites: ["system_attestation", "system_runtime_isolation"],
      summaryPatch: {
        status: attestationStatus === "valid" && hardened && rolloutReady ? "green" : "amber",
        reasonCode: attestationStatus === "valid" && hardened && rolloutReady ? null : "boundary_isolation_unverified",
        reasonText:
          attestationStatus === "valid" && hardened && rolloutReady
            ? null
            : "Attestation/isolation/rollout proof is incomplete.",
        deltaSummary: "trust_closure_refreshed",
        nextAction: attestationStatus === "valid" && hardened && rolloutReady ? null : "refresh_trust_closure",
      },
    };
  }

  if (room === "ops" && (actionName === "health_refresh" || actionName === "baseline_capture" || actionName === "canary_deploy" || actionName === "rollback")) {
    const canaryOverride = actionName === "canary_deploy"
      ? (getPayloadString(payload, "status") ?? getPayloadString(payload, "canaryStatus") ?? "unverified")
      : undefined;
    const rollbackOverride = actionName === "rollback"
      ? (getPayloadString(payload, "status") ?? getPayloadString(payload, "rollbackStatus") ?? "unverified")
      : undefined;
    const isolationOverride: { canaryStatus?: string; rollbackStatus?: string } = {};
    if (canaryOverride !== undefined) {
      isolationOverride.canaryStatus = canaryOverride;
    }
    if (rollbackOverride !== undefined) {
      isolationOverride.rollbackStatus = rollbackOverride;
    }
    const isolation = await upsertIsolationStateTx(client, payload, isolationOverride);
    const hardened = isolation.rootfsReadOnly && isolation.droppedCaps && isolation.explicitMountsOnly;
    const rolloutReady = isVerifiedStatus(isolation.canaryStatus) && isVerifiedStatus(isolation.rollbackStatus);
    return {
      domainWrites: ["system_runtime_isolation"],
      summaryPatch: {
        status: hardened && rolloutReady ? "green" : "amber",
        reasonCode: hardened && rolloutReady ? null : "rollback_canary_unverified",
        reasonText: hardened && rolloutReady ? null : "Canary/rollback or isolation hardening is not verified.",
        deltaSummary: "ops_runtime_refresh",
        nextAction: hardened && rolloutReady ? null : "canary_deploy",
      },
    };
  }

  return { domainWrites: [] };
}

export async function registerRoomContractRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/room-contract/rooms", async () => {
    return {
      rooms: Object.entries(ROOM_CONFIG).map(([key, cfg]) => ({
        room: key,
        title: cfg.title,
        recordClass: cfg.recordClass,
        allowedActions: cfg.allowedActions,
      })),
      generatedAtUtc: new Date().toISOString(),
    };
  });

  server.get<{ Params: { room: string } }>("/api/room-contract/rooms/:room", async (request, reply) => {
    const room = resolveRoom(request.params.room);
    if (!room) {
      return reply.status(404).send({ error: "unknown_room" });
    }

    const config = ROOM_CONFIG[room];
    const runtime = runtimeModeService.getRuntimeModeSnapshot();
    const loadedBackbone = await loadBackbone(room);
    const adjustedBackbone = loadedBackbone.synthesized
      ? {
          ...loadedBackbone,
          ...downgradeSynthesizedSummary(room, loadedBackbone.summary, loadedBackbone.statusReasons),
        }
      : loadedBackbone;
    const synthesized = runtime.runtimeMode === "primary_db" ? false : adjustedBackbone.synthesized;
    const stopConditions = await collectStopConditions(
      room,
      adjustedBackbone.summary,
      adjustedBackbone.statusReasons,
      synthesized,
    );
    const stopConditionSplit = buildConditionSplit(stopConditions);
    const primaryReason = adjustedBackbone.statusReasons[0] ?? null;
    const normalizedStatus = normalizeStatus(adjustedBackbone.summary.status);
    const explicitExemptionCode =
      typeof adjustedBackbone.summary.summary_json?.["explicit_exemption_code"] === "string"
        ? adjustedBackbone.summary.summary_json["explicit_exemption_code"] as string
        : null;
    const summaryValidation = validateRoomSummary({
      roomKey: room,
      statusColor: normalizedStatus,
      reasonCode: primaryReason?.reason_code ?? null,
      reasonText: primaryReason?.reason_text ?? null,
      deltaSummary:
        typeof adjustedBackbone.summary.summary_json?.["delta_summary"] === "string"
          ? adjustedBackbone.summary.summary_json["delta_summary"] as string
          : null,
      updatedAtUtc: adjustedBackbone.summary.updated_at,
      owner: room,
      evidenceRef: adjustedBackbone.summary.evidence_ref,
      nextAction: primaryReason?.next_action ?? null,
      nextUpdateEta: primaryReason?.next_update_eta ?? null,
      explicitExemptionCode,
    });

    return {
      room,
      title: config.title,
      summary: {
        status: normalizedStatus,
        recordClass: adjustedBackbone.summary.record_class,
        evidenceRef: adjustedBackbone.summary.evidence_ref,
        data: adjustedBackbone.summary.summary_json,
        updatedAtUtc: adjustedBackbone.summary.updated_at,
      },
      statusReasons: adjustedBackbone.statusReasons,
      changeEvents: adjustedBackbone.changeEvents,
      actions: adjustedBackbone.actions,
      allowedActions: config.allowedActions,
      gates: {
        nonGreenHasMandatoryReasonCompanions:
          normalizedStatus === "green" || adjustedBackbone.statusReasons.every(hasReasonCompanionFields),
        evidenceBeforeGreen:
          normalizedStatus !== "green" ||
          Boolean(adjustedBackbone.summary.evidence_ref) ||
          Boolean(explicitExemptionCode),
        stopConditions: stopConditionSplit.conditions,
        hasReadBlockingConditions: stopConditionSplit.hasReadBlockingConditions,
        hasWriteBlockingConditions: stopConditionSplit.hasWriteBlockingConditions,
      },
      stopConditions: stopConditionSplit,
      contractValidation: summaryValidation,
      runtimeMode: runtime.runtimeMode,
      isSynthesized: synthesized,
      synthesized,
      generatedAtUtc: new Date().toISOString(),
    };
  });

  server.post<{
    Params: { room: string };
    Body: { actionName?: string; requestedBy?: string; payload?: Record<string, unknown>; evidenceRef?: string | null };
  }>("/api/room-contract/rooms/:room/actions", async (request, reply) => {
    const room = resolveRoom(request.params.room);
    if (!room) {
      return reply.status(404).send({ error: "unknown_room" });
    }

    const actionName = request.body?.actionName?.trim();
    if (!actionName) {
      return reply.status(400).send({ error: "action_name_required" });
    }

    const config = ROOM_CONFIG[room];
    if (!config.allowedActions.includes(actionName)) {
      return reply.status(403).send({
        error: "action_not_allowed",
        allowedActions: config.allowedActions,
      });
    }

    const actorRole = parseActorRole(request.headers["x-vyrdx-role"]);
    if (!actorRole) {
      return reply.status(401).send({
        error: "actor_role_required",
        acceptedRoles: ["authority", "operator", "system"],
      });
    }

    const allowedRoles = ROOM_ROLE_POLICY[room];
    if (!allowedRoles.includes(actorRole)) {
      return reply.status(403).send({
        error: "policy_denied",
        room,
        actionName,
        actorRole,
        allowedRoles,
      });
    }

    try {
      runtimeModeService.requirePrimaryDbMode(`room_action:${room}:${actionName}`);
    } catch (error) {
      if (error instanceof runtimeModeService.RuntimeModeError) {
        return reply.status(503).send({
          error: error.code,
          reason: error.reason,
          scope: error.scope,
          runtimeMode: error.runtimeMode,
          detail: error.message,
        });
      }
      throw error;
    }

    const actionId = randomUUID();
    const actorHeader = typeof request.headers["x-vyrdx-actor"] === "string"
      ? request.headers["x-vyrdx-actor"].trim()
      : "";
    const requestedBy = actorHeader || request.body?.requestedBy?.trim() || `${actorRole}:anonymous`;
    const rawPayload = request.body?.payload ?? {};
    const evidenceRef = normalizeEvidenceRef(
      room,
      actionName,
      actionId,
      requestedBy,
      request.body?.evidenceRef?.trim() ?? null,
    );
    const payload = sanitizeActionPayloadForAudit(room, actionName, rawPayload, requestedBy, evidenceRef);

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const mutation = await applyRoomActionMutationTx(client, room, actionName, payload, {
        requestedBy,
        evidenceRef,
      });

      await client.query(
        `INSERT INTO room_actions (room_key, action_key, action_label, is_enabled, requires_policy, requires_evidence, created_at, updated_at)
         VALUES ($1, $2, $3, true, true, true, now(), now())
         ON CONFLICT (room_key, action_key) DO UPDATE
           SET action_label = EXCLUDED.action_label,
               updated_at = now()`,
        [room, actionName, actionName],
      );

      await client.query(
        `INSERT INTO room_change_events (room_key, event_type, event_payload, evidence_ref, created_by, created_at)
         VALUES ($1, 'action_requested', $2, $3, $4, now())`,
        [room, JSON.stringify({ actionId, actionName, payload, actorRole }), evidenceRef, requestedBy],
      );

      await client.query(
        `INSERT INTO room_change_events (room_key, event_type, event_payload, evidence_ref, created_by, created_at)
         VALUES ($1, 'policy_evaluated', $2, $3, $4, now())`,
        [room, JSON.stringify({ allowed: true, actorRole, actionName }), evidenceRef, requestedBy],
      );

      await client.query(
        `INSERT INTO room_change_events (room_key, event_type, event_payload, evidence_ref, created_by, created_at)
         VALUES ($1, 'domain_mutation_applied', $2, $3, $4, now())`,
        [
          room,
          JSON.stringify({
            actionName,
            domainWrites: mutation.domainWrites,
          }),
          evidenceRef,
          requestedBy,
        ],
      );

      if (mutation.summaryPatch) {
        await upsertRoomSummaryTx(client, room, mutation.summaryPatch, evidenceRef, requestedBy);
      }

      const evidence = await appendEvidenceLedgerTx(client, {
        evidenceRef,
        eventType: "room_action_requested",
        actor: requestedBy,
        payload: {
          room,
          actionId,
          actionName,
          actorRole,
          payload,
        },
      });

      await client.query("COMMIT");

      return reply.status(201).send({
        ok: true,
        room,
        actionId,
        actionName,
        status: "open",
        requestedBy,
        domainWrites: mutation.domainWrites,
        evidenceRef: evidence.evidenceRef,
        evidenceChainHash: evidence.chainHash,
        createdAtUtc: new Date().toISOString(),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  server.get("/api/room-contract/stop-conditions", async () => {
    const stopByRoom: Record<string, StopConditionSplit> = {};
    const allConditions: StopCondition[] = [];
    const runtime = runtimeModeService.getRuntimeModeSnapshot();
    for (const room of Object.keys(ROOM_CONFIG) as RoomKey[]) {
      const loadedBackbone = await loadBackbone(room);
      const adjustedBackbone = loadedBackbone.synthesized
        ? {
            ...loadedBackbone,
            ...downgradeSynthesizedSummary(room, loadedBackbone.summary, loadedBackbone.statusReasons),
          }
        : loadedBackbone;
      const synthesized = runtime.runtimeMode === "primary_db" ? false : adjustedBackbone.synthesized;
      const roomConditions = await collectStopConditions(
        room,
        adjustedBackbone.summary,
        adjustedBackbone.statusReasons,
        synthesized,
      );
      const split = buildConditionSplit(roomConditions);
      stopByRoom[room] = split;
      for (const condition of roomConditions) {
        pushStopCondition(allConditions, condition);
      }
    }

    return {
      runtimeMode: runtime.runtimeMode,
      hasReadBlockingConditions: allConditions.some((condition) => condition.scope === "read"),
      hasWriteBlockingConditions: allConditions.some((condition) => condition.scope === "write"),
      conditions: allConditions,
      stopConditionsByRoom: stopByRoom,
      generatedAtUtc: new Date().toISOString(),
    };
  });
}
