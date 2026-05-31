import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

const nowIso = new Date().toISOString();

const mocked = vi.hoisted(() => ({
  queryOne: vi.fn(async (sql: string) => {
    if (sql.includes("FROM room_summary")) {
      return {
        room_key: "market",
        status_color: "green",
        reason_code: null,
        reason_text: null,
        delta_summary: "market_live",
        updated_at_utc: nowIso,
        owner: "market-service",
        evidence_ref: "evd_market_summary",
        next_action: null,
        next_update_eta: null,
      };
    }

    if (sql.includes("FROM market_sources")) {
      return {
        source_name: "target_market_registry",
        status: "connected",
        last_sync_utc: nowIso,
        last_error: null,
      };
    }

    if (sql.includes("COUNT(*) FILTER (WHERE is_active = true")) {
      return {
        target_count: "20",
      };
    }

    if (sql.includes("MAX(captured_at)")) {
      return {
        latest_intel_utc: nowIso,
      };
    }

    if (sql.includes("FROM market_analysis")) {
      return {
        regime: "live",
        trend_summary: "computed_from_persisted_live_snapshots",
        bullish_count: 8,
        bearish_count: 5,
        anomaly_count: 2,
        review_timestamp: nowIso,
      };
    }

    return null;
  }),
  query: vi.fn(async (sql: string) => {
    if (sql.includes("FROM room_status_reasons")) return [];
    if (sql.includes("FROM room_change_events")) return [];
    if (sql.includes("FROM room_actions")) return [];
    if (sql.includes("FROM system_runtime_isolation")) return [];
    return [];
  }),
}));

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

describe("room-contract market persistence", () => {
  it("returns persisted market data in primary_db mode without synthesized blockers", async () => {
    const app = Fastify();
    await registerRoomContractRoutes(app);

    const roomRes = await app.inject({
      method: "GET",
      url: "/api/room-contract/rooms/market",
    });
    expect(roomRes.statusCode).toBe(200);
    const roomPayload = roomRes.json() as {
      runtimeMode: string;
      isSynthesized: boolean;
      summary: { data: Record<string, unknown> };
    };
    expect(roomPayload.runtimeMode).toBe("primary_db");
    expect(roomPayload.isSynthesized).toBe(false);
    expect(roomPayload.summary.data["source_01_status"]).toBe("connected");
    expect(roomPayload.summary.data["target_universe_count"]).toBe(20);
    expect(typeof roomPayload.summary.data["latest_intel_utc"]).toBe("string");

    const stopRes = await app.inject({
      method: "GET",
      url: "/api/room-contract/stop-conditions",
    });
    expect(stopRes.statusCode).toBe(200);
    const stopPayload = stopRes.json() as {
      conditions: Array<{ code: string; scope: "read" | "write"; source?: string }>;
    };
    expect(stopPayload.conditions.some((entry) => entry.code === "synthesized_mode")).toBe(false);
    expect(stopPayload.conditions.some((entry) => entry.code === "target_registry_empty")).toBe(false);
    expect(stopPayload.conditions.some((entry) => entry.code === "market_intel_missing")).toBe(false);
    expect(stopPayload.conditions.some((entry) => entry.code === "market_source_disconnected")).toBe(false);

    await app.close();
  });
});
