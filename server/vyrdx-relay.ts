/**
 * VYRDX Relay — DELL-side HTTP server exposing /opt/vyrdx state over Tailscale.
 *
 * BOUNDARY LAW:
 *   - Binds to Tailscale IP ONLY (100.75.146.24:7801). Never 0.0.0.0.
 *   - READ-ONLY state export. No write/exec routes.
 *   - Only the VYRDx droplet (100.107.27.53) may call this relay.
 *   - KITTY is the observer, never the executor of cloud operations.
 *
 * Usage: npx tsx server/vyrdx-relay.ts
 */

import Fastify from "fastify";
import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

function toLaunchEvidenceStamp(value: string): string {
  if (value.startsWith("evd_launch_")) return value;
  const short = value.replace(/[^a-f0-9]/gi, "").slice(0, 24) || "000000000000000000000000";
  return `evd_launch_${short}`;
}

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const VYRDX_CORE = process.env.VYRDX_CORE_BASE ?? "/opt/vyrdx/core";
const STATE_DIR = join(VYRDX_CORE, "state");
const PORT = Number(process.env.VYRDX_RELAY_PORT ?? 7801);
// BOUNDARY ENFORCEMENT: bind to Tailscale IP only — never 0.0.0.0
// Default is Tailscale IP of this machine (t79 Dell). Override only for dev.
const HOST = process.env.VYRDX_RELAY_HOST ?? "100.75.146.24";
const ALLOWED_CALLERS = ["100.107.27.53", "127.0.0.1"]; // droplet Tailscale + loopback only

const app = Fastify({ logger: false });

// ── Caller IP guard ────────────────────────────────────────────────────────
// All routes enforce that the caller is the droplet or loopback.
// This relay is READ-ONLY — no write routes exist.
app.addHook("onRequest", async (req, reply) => {
  const ip = (req.socket.remoteAddress ?? "").replace("::ffff:", "");
  if (!ALLOWED_CALLERS.includes(ip)) {
    return reply.status(403).send({
      ok: false,
      error: "forbidden",
      reason: "origin_not_in_allowed_callers",
      ip,
      allowed: ALLOWED_CALLERS,
    });
  }
});

async function readJsonFile<T = Record<string, unknown>>(
  file: string,
  fallback: T,
): Promise<T> {
  try {
    await access(file);
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ── State file endpoints ───────────────────────────────────────────────────

const STATE_FILES: Record<string, string> = {
  "risk-profile": "risk-profile.json",
  "system-health": "system-health.json",
  "market-model": "market-model.json",
  "learning-memory": "learning-memory.json",
  "integrity-baseline": "integrity-baseline.json",
  "runtime-cache": "runtime.cache",
  "opportunity-log": "opportunity-log.json",
};

app.get("/state/:name", async (req, reply) => {
  const { name } = req.params as { name: string };
  const filename = STATE_FILES[name];
  if (!filename) {
    return reply.status(404).send({ error: `unknown state file: ${name}` });
  }
  const data = await readJsonFile(join(STATE_DIR, filename), {});
  return data;
});

// ── Full snapshot ──────────────────────────────────────────────────────────

app.get("/snapshot", async () => {
  const [riskProfile, systemHealth, marketModel, learningMemory, _integrityBaseline, _runtimeCache, opportunityLog] =
    await Promise.all([
      readJsonFile(join(STATE_DIR, "risk-profile.json"), {}),
      readJsonFile(join(STATE_DIR, "system-health.json"), {}),
      readJsonFile(join(STATE_DIR, "market-model.json"), {}),
      readJsonFile(join(STATE_DIR, "learning-memory.json"), {}),
      readJsonFile(join(STATE_DIR, "integrity-baseline.json"), {}),
      readJsonFile(join(STATE_DIR, "runtime.cache"), {}),
      readJsonFile(join(STATE_DIR, "opportunity-log.json"), { items: [] }),
    ]);

  const hardware = (systemHealth as Record<string, unknown>).hardware as Record<string, unknown> | undefined;
  const services = (systemHealth as Record<string, unknown>).services as Record<string, unknown> | undefined;
  const analytics = (riskProfile as Record<string, unknown>).analytics as Record<string, unknown> | undefined;
  const security = (riskProfile as Record<string, unknown>).security as Record<string, unknown> | undefined;
  const supervision = (learningMemory as Record<string, unknown>).supervision as Record<string, unknown> | undefined;
  const market = marketModel as Record<string, unknown>;
  const opp = opportunityLog as { items?: unknown[] };

  return {
    timestamp: new Date().toISOString(),
    market: {
      price: market.lastPrice ?? 0,
      volatility: market.volatility ?? 0,
      breakout: market.breakout ?? false,
    },
    health: {
      score: (services as Record<string, unknown>)?.healthScore ?? 0,
      healthy: ((services as Record<string, unknown>)?.healthScore as number ?? 0) > 50,
    },
    hardware: {
      load: (hardware as Record<string, unknown>)?.load1 ?? 0,
      memoryFreeRatio: (hardware as Record<string, unknown>)?.memoryFreeRatio ?? 0,
      cpuTempC: (hardware as Record<string, unknown>)?.cpuTempC ?? null,
    },
    security: {
      chainOk: (security as Record<string, unknown>)?.chainOk ?? false,
      severity: (security as Record<string, unknown>)?.severity ?? "unknown",
    },
    supervision: {
      divergence: (supervision as Record<string, unknown>)?.divergence ?? 0,
      rssMb: (supervision as Record<string, unknown>)?.rssMb ?? 0,
      drifting: (supervision as Record<string, unknown>)?.drifting ?? false,
    },
    analytics: {
      confidence: (analytics as Record<string, unknown>)?.hybrid ?? 0,
      mode: (analytics as Record<string, unknown>)?.recommendedMode ?? "DEFENSIVE",
    },
    opportunities: {
      count: opp.items?.length ?? 0,
      latestConfidence: 0,
    },
    services: {
      chainVerifierHealthy: false,
      feedEngineConnected: false,
      attestationValid: false,
      rtmpAuthRunning: false,
    },
    boot: {
      directiveValid: false,
      lawValid: false,
    },
  };
});

// ── Service status ─────────────────────────────────────────────────────────

app.get("/services", async () => {
  const checks: Record<string, boolean> = {
    chainVerifier: false,
    feedEngine: false,
    attestation: false,
    rtmpAuth: false,
  };

  try {
    const { stdout } = await execFileAsync("systemctl", [
      "is-active",
      "vyrdx-chain-verifier",
      "vyrdx-feed-engine",
      "vyrdx-attestation",
      "vyrdx-rtmp-auth",
    ]).catch(() => ({ stdout: "" }));
    const lines = stdout.trim().split("\n");
    const names = Object.keys(checks);
    lines.forEach((line, i) => {
      if (names[i]) checks[names[i]] = line.trim() === "active";
    });
  } catch {
    // services not installed
  }

  return { ...checks, timestamp: new Date().toISOString() };
});

// ── Utility endpoints ──────────────────────────────────────────────────────

app.get("/health", async () => {
  let stateReadable = false;
  try {
    await access(STATE_DIR);
    stateReadable = true;
  } catch {
    // state dir not accessible
  }

  return {
    status: "ok",
    relay: "vyrdx-relay",
    vyrdxCore: VYRDX_CORE,
    stateDir: STATE_DIR,
    stateReadable,
    host: HOST,
    port: PORT,
    timestamp: new Date().toISOString(),
  };
});

app.get("/sha", async (req) => {
  const { data } = req.query as { data?: string };
  if (!data) return { error: "query param 'data' required" };
  const hash = createHash("sha256").update(data).digest("hex");
  return { hash, evidenceStamp: toLaunchEvidenceStamp(hash) };
});

// ── Start ──────────────────────────────────────────────────────────────────

app.listen({ port: PORT, host: HOST }, (err) => {
  if (err) {
    console.error("[vyrdx-relay] Failed to start:", err.message);
    process.exit(1);
  }
  console.log(`[vyrdx-relay] Listening on ${HOST}:${PORT}`);
  console.log(`[vyrdx-relay] VYRDX_CORE=${VYRDX_CORE}`);
  console.log(`[vyrdx-relay] STATE_DIR=${STATE_DIR}`);
});
