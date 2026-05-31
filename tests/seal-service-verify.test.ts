import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  queryOne: vi.fn(async (sql: string) => {
    if (sql.includes("FROM proofs p JOIN seals s ON p.seal_id = s.id") && sql.includes("WHERE p.id = $1")) {
      return {
        proof_id: "proof_revoked",
        seal_id: "seal_revoked",
        payload_json: JSON.stringify({ id: "seal_revoked" }),
        payload_sha256: "abc",
        previous_hash: "",
        seal_created_at: new Date().toISOString(),
        seal_status: "revoked",
        is_public: false,
      };
    }
    return null;
  }),
  query: vi.fn(async () => []),
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

import { registerSealService } from "../server/api/seal-service.js";

describe("seal-service verify", () => {
  it("returns revoked verification state for revoked certificate", async () => {
    const app = Fastify();
    await registerSealService(app);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/proofs/verify",
      payload: { proofId: "proof_revoked" },
    });

    expect(res.statusCode).toBe(200);
    const payload = res.json() as {
      valid: boolean;
      status: string;
      reason?: string;
      sealId?: string;
    };
    expect(payload.valid).toBe(false);
    expect(payload.status).toBe("revoked");
    expect(payload.reason).toBe("certificate_revoked");
    expect(payload.sealId).toBe("seal_revoked");

    await app.close();
  });
});

