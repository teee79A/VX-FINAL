import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerSealRoutes } from "../server/seal-api.js";

const cleanupRoots: string[] = [];

async function createSealServer(root: string) {
  const app = Fastify();
  await registerSealRoutes(app, {
    evidenceDir: path.join(root, "state", "seals"),
    proofBaseUrl: "https://vyrdx.vyrdon.com",
  });
  return app;
}

async function createTempRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "kitty-seal-api-"));
  cleanupRoots.push(root);
  return root;
}

afterEach(async () => {
  while (cleanupRoots.length > 0) {
    const root = cleanupRoots.pop();
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  }
});

describe("seal api", () => {
  it("creates a seal and renders a passing proof page", async () => {
    const root = await createTempRoot();
    const app = await createSealServer(root);

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/v1/seal",
        payload: {
          action: "invoice.sent",
          entityType: "invoice",
          entityId: "INV-001",
          actor: "test@vyrdon.com",
          payload: { amount: 5000 },
          workspace: "acme",
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const created = createResponse.json();
      expect(created.proof).toMatch(/^https:\/\/vyrdx\.vyrdon\.com\/proof\/vyrdon-seal-/);
      expect(created.status).toBe("VYRDON CERTIFIED TRUE");
      expect(created.usageCount).toBe(1);

      const proofResponse = await app.inject({
        method: "GET",
        url: new URL(created.proof).pathname,
      });

      expect(proofResponse.statusCode).toBe(200);
      expect(proofResponse.headers["content-type"]).toContain("text/html");
      expect(proofResponse.body).toContain("VYRDON CERTIFIED TRUE = PASS");
      expect(proofResponse.body).toContain(created.sealId);
      expect(proofResponse.body).toContain("invoice.sent");
    } finally {
      await app.close();
    }
  });

  it("reloads persisted seals for proof and listing on a fresh server instance", async () => {
    const root = await createTempRoot();
    const firstApp = await createSealServer(root);

    let sealId = "";
    try {
      const createResponse = await firstApp.inject({
        method: "POST",
        url: "/api/v1/seal",
        payload: {
          action: "contract.signed",
          entityType: "contract",
          entityId: "MSA-9",
          actor: "ops@vyrdon.com",
          payload: { signer: "acme" },
          workspace: "ops",
        },
      });

      sealId = createResponse.json().sealId;
    } finally {
      await firstApp.close();
    }

    const secondApp = await createSealServer(root);
    try {
      const proofResponse = await secondApp.inject({
        method: "GET",
        url: `/proof/${sealId}`,
      });
      expect(proofResponse.statusCode).toBe(200);
      expect(proofResponse.body).toContain("VYRDON CERTIFIED TRUE = PASS");

      const listResponse = await secondApp.inject({
        method: "GET",
        url: "/api/v1/seals?workspace=ops",
      });

      expect(listResponse.statusCode).toBe(200);
      const listed = listResponse.json();
      expect(listed.count).toBe(1);
      expect(listed.seals[0]?.sealId).toBe(sealId);
      expect(listed.usage).toBe(1);
    } finally {
      await secondApp.close();
    }
  });
});
