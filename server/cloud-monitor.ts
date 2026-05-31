/**
 * KITTY Cloud Monitor — VXStation observer for VYRDx cloud runtime.
 *
 * BOUNDARY LAW (enforced):
 *   - KITTY is READ-ONLY observer. No execution authority over cloud.
 *   - All requests go via SSH tunnel to boundary gateway (Tailscale ACL blocks direct TCP).
 *   - SSH tunnel: 127.0.0.1:7891 → root@134.199.227.138 → 100.107.27.53:7890
 *   - Token auth via KITTY_BOUNDARY_TOKEN env var.
 *   - This module NEVER sends commands to cloud services.
 *   - This module NEVER exposes cloud credentials locally.
 *
 * Exposes local monitor API on 127.0.0.1:7802 for KITTY dashboard.
 */

import Fastify from "fastify";
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KITTY_ROOT = process.env.KITTY_ROOT ?? "/home/t79/KITTY";

// ── Boundary config ────────────────────────────────────────────────────────
const BOUNDARY_TOKEN = process.env.KITTY_BOUNDARY_TOKEN ?? (() => {
  try {
    const lines = readFileSync("/home/t79/.cloudflared/kitty-boundary.env", "utf8").split("\n");
    for (const line of lines) {
      if (line.startsWith("KITTY_BOUNDARY_TOKEN=")) return (line.split("=")[1] ?? "").trim();
    }
  } catch {}
  return null;
})();

// SSH tunnel config — forward local 7891 → droplet → 100.107.27.53:7890 (boundary)
// Tailscale ACL blocks direct TCP to 7890; SSH tunnel routes via the droplet's internal network.
const DROPLET_HOST = "134.199.227.138";
const DROPLET_SSH_KEY = "/home/t79/.ssh/id_ed25519_linklock_dell";
const BOUNDARY_REMOTE_HOST = "100.107.27.53"; // boundary's Tailscale IP, reachable on droplet
const BOUNDARY_REMOTE_PORT = 7890;
const BOUNDARY_LOCAL_PORT = 7891;            // SSH tunnel local forward port
const LOCAL_PORT = Number(process.env.CLOUD_MONITOR_PORT ?? 7802);
const LOCAL_HOST = "127.0.0.1"; // KITTY monitor stays local — never exposed

// ── SSH Tunnel management ──────────────────────────────────────────────────
let sshTunnelProc: ReturnType<typeof spawn> | null = null;
let tunnelReady = false;

function isTunnelPortFree(): Promise<boolean> {
  return new Promise(resolve => {
    const s = createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => { s.close(); resolve(true); });
    s.listen(BOUNDARY_LOCAL_PORT, "127.0.0.1");
  });
}

async function ensureSshTunnel(): Promise<void> {
  if (sshTunnelProc && sshTunnelProc.exitCode === null && tunnelReady) return;

  // Kill stale tunnel process
  if (sshTunnelProc) {
    sshTunnelProc.kill("SIGTERM");
    sshTunnelProc = null;
    tunnelReady = false;
    await new Promise(r => setTimeout(r, 400));
  }

  const free = await isTunnelPortFree();
  if (!free) {
    // Port occupied — another process holds the tunnel; assume ready
    tunnelReady = true;
    return;
  }

  sshTunnelProc = spawn("ssh", [
    "-i", DROPLET_SSH_KEY,
    "-o", "StrictHostKeyChecking=no",
    "-o", "BatchMode=yes",
    "-o", "ServerAliveInterval=15",
    "-o", "ExitOnForwardFailure=yes",
    // Forward: local 7891 → remote 100.107.27.53:7890 (boundary Tailscale IP)
    "-L", `${BOUNDARY_LOCAL_PORT}:${BOUNDARY_REMOTE_HOST}:${BOUNDARY_REMOTE_PORT}`,
    "-N",
    `root@${DROPLET_HOST}`,
  ], { stdio: "ignore", detached: false });

  sshTunnelProc.on("exit", (code) => {
    tunnelReady = false;
    sshTunnelProc = null;
    logEvent({ event: "SSH_TUNNEL_EXITED", code });
  });

  // Wait up to 6s for tunnel port to open
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 300));
    const stillFree = await isTunnelPortFree();
    if (!stillFree) { tunnelReady = true; break; }
  }
  logEvent({ event: "SSH_TUNNEL_STARTED", ready: tunnelReady, port: BOUNDARY_LOCAL_PORT });
}

const CLOUD_MONITOR_LOG = join(KITTY_ROOT, "data", "cloud-monitor.ndjson");

// ── Types ──────────────────────────────────────────────────────────────────
interface ServiceStatus {
  name: string;
  port: number;
  up: boolean;
}

interface CloudStatus {
  ok: boolean;
  timestamp: string;
  cloud: {
    droplet: string;
    tailscale: string;
    services_up: number;
    services_total: number;
    health: string;
  };
  services: ServiceStatus[];
}

// ── Internal state cache ──────────────────────────────────────────────────
let lastStatus: CloudStatus | null = null;
let lastPollTs = 0;
let pollErrors = 0;

function nowIso() { return new Date().toISOString(); }

function logEvent(entry: Record<string, unknown>) {
  try {
    mkdirSync(dirname(CLOUD_MONITOR_LOG), { recursive: true });
    appendFileSync(CLOUD_MONITOR_LOG, JSON.stringify({ ...entry, ts: nowIso() }) + "\n");
  } catch {}
}

// ── Boundary fetch (via SSH tunnel → boundary gateway) ────────────────────
async function boundaryFetch(path: string): Promise<{ ok: boolean; data: unknown; status: number }> {
  if (!BOUNDARY_TOKEN) {
    return { ok: false, data: { error: "KITTY_BOUNDARY_TOKEN not configured" }, status: 503 };
  }

  await ensureSshTunnel();
  if (!tunnelReady) {
    return { ok: false, data: { error: "SSH tunnel not ready — boundary unreachable" }, status: 503 };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `http://127.0.0.1:${BOUNDARY_LOCAL_PORT}${path}`;
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${BOUNDARY_TOKEN}`,
        "X-Kitty-Origin": "vxstation-local",
        "X-Kitty-Version": "1.0",
      },
    });
    const data = await res.json() as unknown;
    return { ok: res.ok, data, status: res.status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return { ok: false, data: { error: msg }, status: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Poll cloud status ──────────────────────────────────────────────────────
async function pollCloud(): Promise<void> {
  const result = await boundaryFetch("/cloud/status");
  lastPollTs = Date.now();

  if (result.ok) {
    lastStatus = result.data as CloudStatus;
    pollErrors = 0;
    logEvent({ event: "POLL_OK", health: lastStatus.cloud.health, up: lastStatus.cloud.services_up });
  } else {
    pollErrors++;
    logEvent({ event: "POLL_FAILED", status: result.status, error: (result.data as Record<string, unknown>)?.error, errors: pollErrors });
  }
}

// ── Fastify app (127.0.0.1 only) ─────────────────────────────────────────
const app = Fastify({ logger: false });

app.get("/health", async () => ({
  ok: true,
  service: "kitty-cloud-monitor",
  mode: "READ_ONLY_OBSERVER",
  boundary_token_configured: !!BOUNDARY_TOKEN,
  boundary_via: `ssh-tunnel 127.0.0.1:${BOUNDARY_LOCAL_PORT} → ${DROPLET_HOST} → ${BOUNDARY_REMOTE_HOST}:${BOUNDARY_REMOTE_PORT}`,
  tunnel_ready: tunnelReady,
  local_port: LOCAL_PORT,
  last_poll_ago_ms: lastPollTs ? Date.now() - lastPollTs : null,
  poll_errors: pollErrors,
  timestamp: nowIso(),
}));

app.get("/cloud", async (_req, reply) => {
  if (!lastStatus) {
    await pollCloud();
    if (!lastStatus) {
      return reply.status(503).send({
        ok: false,
        error: "cloud_not_reachable",
        boundary: `ssh-tunnel → ${BOUNDARY_REMOTE_HOST}:${BOUNDARY_REMOTE_PORT}`,
        token_configured: !!BOUNDARY_TOKEN,
      });
    }
  }
  return {
    ...lastStatus,
    cache_age_ms: Date.now() - lastPollTs,
    kitty: {
      mode: "READ_ONLY_OBSERVER",
      authority: "NONE — KITTY observes, never commands",
    },
  };
});

app.get("/cloud/rooms", async (_req, reply) => {
  const result = await boundaryFetch("/cloud/rooms");
  return reply.status(result.ok ? 200 : 503).send(result.data);
});

app.get("/cloud/market", async (_req, reply) => {
  const result = await boundaryFetch("/cloud/market");
  return reply.status(result.ok ? 200 : 503).send(result.data);
});

app.get("/cloud/engines", async (_req, reply) => {
  const result = await boundaryFetch("/cloud/engines");
  return reply.status(result.ok ? 200 : 503).send(result.data);
});

app.get("/cloud/audit", async (_req, reply) => {
  const result = await boundaryFetch("/cloud/audit");
  return reply.status(result.ok ? 200 : 503).send(result.data);
});

app.get("/boundary/test", async (_req, reply) => {
  const result = await boundaryFetch("/health");
  return reply.status(result.ok ? 200 : 503).send({
    ok: result.ok,
    boundary_reachable: result.ok,
    tunnel_ready: tunnelReady,
    boundary_via: `ssh-tunnel 127.0.0.1:${BOUNDARY_LOCAL_PORT} → ${DROPLET_HOST} → ${BOUNDARY_REMOTE_HOST}:${BOUNDARY_REMOTE_PORT}`,
    response: result.data,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────
await app.listen({ port: LOCAL_PORT, host: LOCAL_HOST });
console.log(`[kitty-cloud-monitor] LOCAL OBSERVER on ${LOCAL_HOST}:${LOCAL_PORT}`);
console.log(`[kitty-cloud-monitor] BOUNDARY: ssh-tunnel :${BOUNDARY_LOCAL_PORT} → ${DROPLET_HOST} → ${BOUNDARY_REMOTE_HOST}:${BOUNDARY_REMOTE_PORT}`);
console.log(`[kitty-cloud-monitor] MODE: READ_ONLY — KITTY observes, never commands`);
console.log(`[kitty-cloud-monitor] TOKEN: ${BOUNDARY_TOKEN ? "configured" : "NOT CONFIGURED"}`);

logEvent({ event: "CLOUD_MONITOR_STARTED", local: `${LOCAL_HOST}:${LOCAL_PORT}`, boundary: `ssh-tunnel:${BOUNDARY_LOCAL_PORT}→${DROPLET_HOST}→${BOUNDARY_REMOTE_HOST}:${BOUNDARY_REMOTE_PORT}` });

// Poll every 30s
await pollCloud(); // initial poll
setInterval(pollCloud, 30_000);
