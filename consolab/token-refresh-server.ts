// consolab/token-refresh-server.ts
// Token Refresh Endpoint — VYRDX services call this when their attestation token expires.
// Runs as part of the ConsoLab authority plane on ASUS or any authority node.

import Fastify from "fastify";
import { getAuthority, type AttestationToken } from "./authority.js";
import { HeartbeatManager, type HeartbeatPayload } from "./heartbeat.js";
import os from "node:os";

// ── CONFIG ─────────────────────────────────────────────────────────────────

const PORT = Number(process.env.CONSOLAB_PORT ?? 7900);
const HOST = process.env.CONSOLAB_HOST ?? "0.0.0.0";
const NODE_ID = process.env.CONSOLAB_NODE_ID ?? os.hostname();

// ── BOOT ───────────────────────────────────────────────────────────────────

const authority = await getAuthority();
const heartbeat = new HeartbeatManager(NODE_ID);
heartbeat.registerNode(NODE_ID, "authority");
await heartbeat.loadState();

const app = Fastify({ logger: true });

// ── HEALTH ─────────────────────────────────────────────────────────────────

app.get("/health", async () => {
  return {
    status: "ok",
    node: "consolab-authority",
    nodeId: NODE_ID,
    uptime: process.uptime(),
    nodes: heartbeat.getStatus(),
    timestamp: new Date().toISOString(),
  };
});

// ── TOKEN REFRESH ──────────────────────────────────────────────────────────

app.post<{
  Body: {
    nodeId: string;
    releaseId: string;
    pcrHash: string;
    imaLogHash: string;
  };
}>("/api/attestation/refresh", async (req, reply) => {
  const { nodeId, releaseId, pcrHash, imaLogHash } = req.body ?? {};

  if (!nodeId || !releaseId) {
    reply.status(400);
    return { error: "nodeId and releaseId are required" };
  }

  const result = await authority.signAttestationToken({
    nodeId,
    releaseId,
    pcrHash: pcrHash ?? "UNKNOWN",
    imaLogHash: imaLogHash ?? "UNKNOWN",
  });

  if (!result.ok) {
    reply.status(500);
    return { error: result.error };
  }

  return result.token;
});

// ── TOKEN VERIFICATION ─────────────────────────────────────────────────────

app.post<{ Body: AttestationToken }>("/api/attestation/verify", async (req, reply) => {
  const token = req.body;
  if (!token?.payload || !token?.signature) {
    reply.status(400);
    return { valid: false, error: "Invalid token format" };
  }

  const valid = authority.verifyToken(token);
  const expired = new Date(token.payload.expiresAtUTC) < new Date();

  return {
    valid: valid && !expired,
    signatureValid: valid,
    expired,
    nodeId: token.payload.nodeId,
    expiresAtUTC: token.payload.expiresAtUTC,
    timestamp: new Date().toISOString(),
  };
});

// ── PUBLIC KEY ──────────────────────────────────────────────────────────────

app.get("/api/attestation/public-key", async () => {
  return {
    publicKey: authority.getPublicKey(),
    timestamp: new Date().toISOString(),
  };
});

// ── CERTIFICATE ISSUANCE ───────────────────────────────────────────────────

app.post<{
  Body: {
    nodeId: string;
    publicKey: string;
    purpose: "attestation" | "service" | "agent";
    requestedBy: string;
  };
}>("/api/certificates/issue", async (req, reply) => {
  const { nodeId, publicKey, purpose, requestedBy } = req.body ?? {};

  if (!nodeId || !publicKey || !purpose || !requestedBy) {
    reply.status(400);
    return { error: "nodeId, publicKey, purpose, and requestedBy are required" };
  }

  const cert = await authority.issueCertificate({ nodeId, publicKey, purpose, requestedBy });
  return cert;
});

// ── HEARTBEAT ──────────────────────────────────────────────────────────────

app.post<{ Body: HeartbeatPayload }>("/api/heartbeat", async (req) => {
  return heartbeat.receiveHeartbeat(req.body);
});

app.get("/api/heartbeat/status", async () => {
  return {
    localNodeId: NODE_ID,
    nodes: heartbeat.getStatus(),
    timestamp: new Date().toISOString(),
  };
});

app.post<{
  Body: { nodeId: string; role: HeartbeatPayload["role"] };
}>("/api/heartbeat/register", async (req) => {
  const { nodeId, role } = req.body ?? {};
  if (!nodeId || !role) return { error: "nodeId and role are required" };
  heartbeat.registerNode(nodeId, role);
  return { registered: true, nodeId, role };
});

// ── LIFECYCLE ──────────────────────────────────────────────────────────────

heartbeat.start(() => ({
  nodeId: NODE_ID,
  role: "authority",
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  attestationValid: true,
  lastTokenRefresh: null,
  servicesHealthy: 1,
  servicesTotal: 1,
  chainHead: "AUTHORITY",
}));

const shutdown = async (signal: string) => {
  console.log(`\n[CONSOLAB] ${signal} received, shutting down...`);
  heartbeat.stop();
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: PORT, host: HOST });
console.log(`[CONSOLAB] Authority plane live on ${HOST}:${PORT}`);
console.log(`[CONSOLAB] Node ID: ${NODE_ID}`);
console.log(`[CONSOLAB] Token refresh: POST /api/attestation/refresh`);
console.log(`[CONSOLAB] Heartbeat: POST /api/heartbeat`);
