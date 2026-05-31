import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerRoomContractRoutes } from "../server/api/room-contract.js";
import { runtimeModeService } from "../server/services/runtimeModeService.js";

function buildMarketRows(count = 25): Array<{
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
}> {
  return Array.from({ length: count }, (_, index) => ({
    symbol: `tk${index + 1}`,
    name: `Token ${index + 1}`,
    current_price: 100 + index,
    price_change_percentage_24h: index % 2 === 0 ? 2.4 : -1.1,
    price_change_percentage_7d_in_currency: index % 3 === 0 ? 5.2 : -0.4,
  }));
}

async function createRoomContractServer() {
  const app = Fastify();
  await registerRoomContractRoutes(app);
  return app;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("room contract api", () => {
  it("downgrades synthesized rooms and enforces write blockers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("coingecko")) {
          return new Response(JSON.stringify(buildMarketRows()), { status: 200 });
        }
        if (url.endsWith("/health")) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response("not-found", { status: 404 });
      }),
    );

    const app = await createRoomContractServer();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/room-contract/rooms/commercial",
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json() as {
        synthesized: boolean;
        summary: {
          status: "green" | "amber" | "red";
          data: Record<string, unknown>;
        };
        gates: {
          hasWriteBlockingConditions: boolean;
          stopConditions: Array<{ code: string; scope: "read" | "write" }>;
        };
      };

      expect(payload.synthesized).toBe(true);
      expect(payload.summary.status).not.toBe("green");
      expect(payload.summary.data["certificate_eligible"]).toBe(false);
      expect(payload.summary.data["certificate_issue_ready"]).toBe(false);
      expect(payload.gates.hasWriteBlockingConditions).toBe(true);
      expect(payload.gates.stopConditions.some((item) => item.code === "synthesized_mode" && item.scope === "write")).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("returns read/write stop-condition split format", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("coingecko")) {
          return new Response(JSON.stringify(buildMarketRows()), { status: 200 });
        }
        if (url.endsWith("/health")) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response("not-found", { status: 404 });
      }),
    );

    const app = await createRoomContractServer();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/room-contract/stop-conditions",
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json() as {
        hasReadBlockingConditions: boolean;
        hasWriteBlockingConditions: boolean;
        conditions: Array<{ code: string; scope: "read" | "write" }>;
        stopConditionsByRoom: Record<string, {
          hasReadBlockingConditions: boolean;
          hasWriteBlockingConditions: boolean;
          conditions: Array<{ code: string; scope: "read" | "write" }>;
        }>;
      };

      expect(typeof payload.hasReadBlockingConditions).toBe("boolean");
      expect(payload.hasWriteBlockingConditions).toBe(true);
      expect(Array.isArray(payload.conditions)).toBe(true);
      expect(payload.conditions.every((entry) => entry.scope === "read" || entry.scope === "write")).toBe(true);
      expect(payload.stopConditionsByRoom.commercial?.hasWriteBlockingConditions).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("never emits synthesized mode in primary_db", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.endsWith("/health")) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response("not-found", { status: 404 });
      }),
    );
    vi.spyOn(runtimeModeService, "getRuntimeModeSnapshot").mockReturnValue({
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
    });

    const app = await createRoomContractServer();
    try {
      const roomResponse = await app.inject({
        method: "GET",
        url: "/api/room-contract/rooms/commercial",
      });
      expect(roomResponse.statusCode).toBe(200);
      const roomPayload = roomResponse.json() as {
        runtimeMode: string;
        isSynthesized: boolean;
        synthesized: boolean;
      };
      expect(roomPayload.runtimeMode).toBe("primary_db");
      expect(roomPayload.isSynthesized).toBe(false);
      expect(roomPayload.synthesized).toBe(false);

      const stopResponse = await app.inject({
        method: "GET",
        url: "/api/room-contract/stop-conditions",
      });
      expect(stopResponse.statusCode).toBe(200);
      const stopPayload = stopResponse.json() as {
        runtimeMode: string;
        conditions: Array<{ code: string; scope: "read" | "write"; source?: string }>;
      };
      expect(stopPayload.runtimeMode).toBe("primary_db");
      expect(stopPayload.conditions.some((entry) => entry.code === "synthesized_mode")).toBe(false);
      expect(stopPayload.conditions.every((entry) => typeof entry.source === "string")).toBe(true);
    } finally {
      await app.close();
    }
  });
});
