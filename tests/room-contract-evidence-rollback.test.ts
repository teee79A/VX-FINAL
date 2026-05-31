import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => {
  const clientQuery = vi.fn(async (sql: string) => {
    if (sql === "BEGIN" || sql === "ROLLBACK" || sql === "COMMIT") {
      return { rows: [] };
    }
    return { rows: [] };
  });

  return {
    query: vi.fn(async () => []),
    queryOne: vi.fn(async () => null),
    clientQuery,
    release: vi.fn(),
    appendEvidenceLedgerTx: vi.fn(async () => {
      throw new Error("evidence_insert_failed");
    }),
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
      updatedAtUtc: new Date().toISOString(),
    })),
  };
});

vi.mock("../server/db.js", () => ({
  query: mocked.query,
  queryOne: mocked.queryOne,
  getPool: () => ({
    connect: async () => ({
      query: mocked.clientQuery,
      release: mocked.release,
    }),
  }),
}));

vi.mock("../server/lib/evidence-ledger.js", () => ({
  appendEvidenceLedgerTx: mocked.appendEvidenceLedgerTx,
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
      requirePrimaryDbMode: mocked.requirePrimaryDbMode,
      getRuntimeModeSnapshot: mocked.getRuntimeModeSnapshot,
      RuntimeModeError,
    },
  };
});

import { registerRoomContractRoutes } from "../server/api/room-contract.js";

describe("room-contract evidence rollback", () => {
  it("returns evidenceRef when sensitive action succeeds", async () => {
    mocked.clientQuery.mockClear();
    mocked.release.mockClear();
    mocked.appendEvidenceLedgerTx.mockResolvedValueOnce({
      evidenceRef: "evd_success_test",
      chainHash: "chain_hash_success",
    } as never);

    const app = Fastify();
    await registerRoomContractRoutes(app);

    const res = await app.inject({
      method: "POST",
      url: "/api/room-contract/rooms/ops/actions",
      headers: {
        "content-type": "application/json",
        "x-vyrdx-role": "operator",
        "x-vyrdx-actor": "usr_test",
      },
      payload: {
        actionName: "health_refresh",
        evidenceRef: "evd_success_test",
        payload: { source: "unit-test" },
      },
    });

    expect(res.statusCode).toBe(201);
    const payload = res.json() as { evidenceRef: string; evidenceChainHash: string };
    expect(payload.evidenceRef).toBe("evd_success_test");
    expect(payload.evidenceChainHash).toBe("chain_hash_success");
    expect(mocked.clientQuery).toHaveBeenCalledWith("COMMIT");

    await app.close();
  });

  it("rolls back room action transaction when evidence append fails", async () => {
    mocked.clientQuery.mockClear();
    mocked.release.mockClear();
    mocked.appendEvidenceLedgerTx.mockClear();
    mocked.appendEvidenceLedgerTx.mockRejectedValueOnce(new Error("evidence_insert_failed"));

    const app = Fastify();
    await registerRoomContractRoutes(app);

    const res = await app.inject({
      method: "POST",
      url: "/api/room-contract/rooms/ops/actions",
      headers: {
        "content-type": "application/json",
        "x-vyrdx-role": "operator",
        "x-vyrdx-actor": "usr_test",
      },
      payload: {
        actionName: "health_refresh",
        evidenceRef: "evd_rollback_test",
        payload: { source: "unit-test" },
      },
    });

    expect(res.statusCode).toBe(500);
    expect(mocked.appendEvidenceLedgerTx).toHaveBeenCalledTimes(1);
    expect(mocked.clientQuery).toHaveBeenCalledWith("BEGIN");
    expect(mocked.clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mocked.clientQuery).not.toHaveBeenCalledWith("COMMIT");
    expect(mocked.release).toHaveBeenCalledTimes(1);

    await app.close();
  });
});
