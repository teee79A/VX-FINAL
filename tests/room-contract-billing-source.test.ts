import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

const nowIso = new Date().toISOString();

type BillingRow = {
  billing_source: string;
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
  invoice_count_open: number;
  invoice_count_paid: number;
  invoice_count_failed: number;
  renewals_due_30d: number;
  last_billing_sync_utc: string | null;
};

const mocked = vi.hoisted(() => {
  let billingRow: BillingRow | null = null;
  return {
    setBillingRow(next: BillingRow | null) {
      billingRow = next;
    },
    queryOne: vi.fn(async (sql: string) => {
      if (sql.includes("FROM commercial_billing_summary")) {
        return billingRow;
      }
      if (sql.includes("certificate_entitled_count")) {
        return { certificate_entitled_count: "1" };
      }
      if (sql.includes("FROM commercial_certificates")) {
        return null;
      }
      if (sql.includes("FROM room_summary")) {
        return {
          room_key: "commercial",
          status_color: "green",
          reason_code: null,
          reason_text: null,
          delta_summary: "billing_synced",
          updated_at_utc: nowIso,
          owner: "commercial-service",
          evidence_ref: "evd_room_summary_commercial",
          next_action: null,
          next_update_eta: null,
        };
      }
      return null;
    }),
    query: vi.fn(async (sql: string) => {
      if (sql.includes("FROM room_status_reasons")) return [];
      if (sql.includes("FROM room_change_events")) return [];
      if (sql.includes("FROM room_actions")) return [];
      return [];
    }),
  };
});

vi.mock("../server/db.js", () => ({
  query: mocked.query,
  queryOne: mocked.queryOne,
  getPool: () => ({
    connect: async () => ({
      query: vi.fn(async () => ({ rows: [] })),
      release: vi.fn(),
    }),
  }),
}));

vi.mock("../server/services/runtimeModeService.js", () => {
  class RuntimeModeError extends Error {
    code = "database_unavailable";
    reason = null;
    scope = "write" as const;
    runtimeMode = "degraded_read_only" as const;
  }

  return {
    runtimeModeService: {
      requirePrimaryDbMode: vi.fn(() => undefined),
      getRuntimeModeSnapshot: vi.fn(() => ({
        isDatabaseConfigured: true,
        isDatabaseHealthy: true,
        runtimeMode: "primary_db",
        lastDatabaseError: null,
        health: {
          configured: true,
          reachable: true,
          migrated: true,
          criticalTablesPresent: true,
          schemaVersion: 20260421,
          requiredSchemaVersion: 20260421,
          missingTables: [],
          lastError: null,
        },
        updatedAtUtc: nowIso,
      })),
      RuntimeModeError,
    },
  };
});

import { registerRoomContractRoutes } from "../server/api/room-contract.js";

function verifiedHybridRow(overrides: Partial<BillingRow> = {}): BillingRow {
  return {
    billing_source: "connected",
    source_type: "hybrid",
    component_paypal: true,
    component_bank_transfer: true,
    component_btc_wallet: true,
    component_eth_wallet: true,
    is_connected: true,
    is_verified: true,
    verification_method: "manual_attested",
    last_verified_at: nowIso,
    verified_by: "ops:anchor",
    evidence_ref: "evd_billing_hybrid",
    bank_account_label: "AC***US",
    bank_routing_last4: "6789",
    bank_account_last4: "1234",
    invoice_count_open: 0,
    invoice_count_paid: 3,
    invoice_count_failed: 0,
    renewals_due_30d: 1,
    last_billing_sync_utc: nowIso,
    ...overrides,
  };
}

async function getCommercialConditions(): Promise<Array<{ code: string; scope: "read" | "write"; source?: string }>> {
  const app = Fastify();
  await registerRoomContractRoutes(app);
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/room-contract/rooms/commercial",
    });
    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      gates: {
        stopConditions: Array<{ code: string; scope: "read" | "write"; source?: string }>;
      };
    };
    return payload.gates.stopConditions;
  } finally {
    await app.close();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("commercial billing source gate", () => {
  it("clears billing_source_not_connected when hybrid billing is verified", async () => {
    mocked.setBillingRow(verifiedHybridRow());
    const conditions = await getCommercialConditions();
    expect(conditions.some((entry) => entry.code === "billing_source_not_connected")).toBe(false);
  });

  it("keeps blocker when evidence_ref is missing", async () => {
    mocked.setBillingRow(verifiedHybridRow({ evidence_ref: null }));
    const conditions = await getCommercialConditions();
    expect(conditions.some((entry) => entry.code === "billing_source_not_connected")).toBe(true);
  });

  it("keeps blocker when is_verified is false", async () => {
    mocked.setBillingRow(verifiedHybridRow({ is_verified: false }));
    const conditions = await getCommercialConditions();
    expect(conditions.some((entry) => entry.code === "billing_source_not_connected")).toBe(true);
  });

  it("keeps blocker when last_verified_at is missing", async () => {
    mocked.setBillingRow(verifiedHybridRow({ last_verified_at: null }));
    const conditions = await getCommercialConditions();
    expect(conditions.some((entry) => entry.code === "billing_source_not_connected")).toBe(true);
  });

  it("does not require Stripe when hybrid billing is verified", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    mocked.setBillingRow(verifiedHybridRow());
    const conditions = await getCommercialConditions();
    expect(conditions.some((entry) => entry.code === "billing_source_not_connected")).toBe(false);
  });
});
