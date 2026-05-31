// server/monitor.ts
// KITTY Glass Cockpit — Full operator surface for Droplet + ASUS + Deploy.
// Polls remote endpoints, fetches room API data, renders live dashboard.
// In local _mode: this is the homepage. Read-only against production.
// In cloud _mode: available at /monitor but not the homepage.

import type { FastifyInstance } from "fastify";
import { ENV, type VxstationMode } from "./env.js";

// ── TYPES ──────────────────────────────────────────────────────────────────

export interface ServiceStatus {
  name: string;
  url: string;
  ok: boolean;
  code: number;
  latencyMs: number;
  checkedAt: string;
  body?: Record<string, unknown> | undefined;
  error?: string | undefined;
}

export type RoomName = "commercial" | "operations" | "evidence" | "camps" | "policy";

export interface RoomStatus {
  room: RoomName;
  routeOk: boolean;
  apiOk: boolean;
  routeCode: number;
  apiCode: number;
  latencyMs: number;
  checkedAt: string;
}

export interface MonitorState {
  droplet: {
    health: ServiceStatus;
    build: ServiceStatus;
    rooms: RoomStatus[];
  };
  asus: {
    health: ServiceStatus;
  };
  polledAt: string;
  pollCount: number;
}

// ── POLLING ENGINE ─────────────────────────────────────────────────────────

const DROPLET_BASE = ENV.dropletUrl;
const ASUS_BASE = ENV.asusUrl;
const POLL_INTERVAL_MS = ENV.monitorPollMs;

const ROOMS: RoomName[] = ["commercial", "operations", "evidence", "camps", "policy"];

let state: MonitorState | null = null;
let pollCount = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function probeEndpoint(name: string, url: string): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "KITTY-Monitor/1.0" },
    });
    const latencyMs = Date.now() - start;
    let body: Record<string, unknown> | undefined;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      /* non-JSON response */
    }
    return { name, url, ok: res.ok, code: res.status, latencyMs, checkedAt: new Date().toISOString(), body };
  } catch (err) {
    return { name, url, ok: false, code: 0, latencyMs: Date.now() - start, checkedAt: new Date().toISOString(), error: err instanceof Error ? err.message : String(err) };
  }
}

async function probeRoom(room: RoomName): Promise<RoomStatus> {
  const start = Date.now();
  const routeUrl = `${DROPLET_BASE}/rooms/${room}`;
  const apiUrl = `${DROPLET_BASE}/api/${room}/summary`;

  const [routeRes, apiRes] = await Promise.allSettled([
    fetch(routeUrl, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "KITTY-Monitor/1.0" } }),
    fetch(apiUrl, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "KITTY-Monitor/1.0" } }),
  ]);

  const routeOk = routeRes.status === "fulfilled" && routeRes.value.ok;
  const apiOk = apiRes.status === "fulfilled" && apiRes.value.ok;
  const routeCode = routeRes.status === "fulfilled" ? routeRes.value.status : 0;
  const apiCode = apiRes.status === "fulfilled" ? apiRes.value.status : 0;

  return { room, routeOk, apiOk, routeCode, apiCode, latencyMs: Date.now() - start, checkedAt: new Date().toISOString() };
}

async function poll(): Promise<MonitorState> {
  pollCount++;

  const [health, build, asusHealth, ...rooms] = await Promise.all([
    probeEndpoint("droplet-health", `${DROPLET_BASE}/health`),
    probeEndpoint("droplet-build", `${DROPLET_BASE}/api/build`),
    probeEndpoint("asus-health", `${ASUS_BASE}/health`),
    ...ROOMS.map((r) => probeRoom(r)),
  ]);

  state = {
    droplet: { health, build, rooms: rooms as RoomStatus[] },
    asus: { health: asusHealth },
    polledAt: new Date().toISOString(),
    pollCount,
  };

  return state;
}

function startPolling(): void {
  if (pollTimer) return;
  void poll();
  pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS);
}

function getState(): MonitorState | null {
  return state;
}

// ── HELPERS ────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── ROUTE REGISTRATION ─────────────────────────────────────────────────────

export async function registerMonitorRoutes(server: FastifyInstance, mode = "local"): Promise<void> {
  startPolling();

  // JSON API
  server.get("/api/monitor", async () => {
    const s = getState();
    if (!s) return poll();
    return s;
  });

  // Full Glass Cockpit HTML — client does its own polling for room data
  server.get("/monitor", async (_req, reply) => {
    const s = getState() ?? await poll();
    const healthBody = s.droplet.health.body ?? {};
    const buildBody = s.droplet.build.body ?? {};
    const asusBody = s.asus.health.body ?? {};

    // Compute overall posture
    const allRoomsOk = s.droplet.rooms.every((r) => r.routeOk && r.apiOk);
    const _someDown = s.droplet.rooms.some((r) => !r.routeOk || !r.apiOk);
    const dropletOk = s.droplet.health.ok;
    const asusOk = s.asus.health.ok;
    const dbStatus = String(healthBody["database"] ?? "unknown");
    const dbOk = dbStatus === "connected";

    const overallOk = dropletOk && asusOk && allRoomsOk && dbOk;
    const overallDegraded = dropletOk && (!allRoomsOk || !asusOk || !dbOk);

    const posture = overallOk ? "ALL SYSTEMS OPERATIONAL" : overallDegraded ? "DEGRADED" : "CRITICAL";
    const postureClass = overallOk ? "ok" : overallDegraded ? "warn" : "crit";

    const uptimeRaw = Number(healthBody["uptime"] ?? 0);
    const uptimeH = Math.floor(uptimeRaw / 3600);
    const uptimeM = Math.floor((uptimeRaw % 3600) / 60);
    const uptimeStr = uptimeH > 0 ? `${uptimeH}h ${uptimeM}m` : `${uptimeM}m`;

    const roomColors: Record<string, string> = { commercial: "#00ff88", operations: "#00ccff", evidence: "#ff6600", camps: "#aa66ff", policy: "#ff2266" };
    const roomIcons: Record<string, string> = { commercial: "◆", operations: "◈", evidence: "◇", camps: "◊", policy: "□" };

    const roomCards = s.droplet.rooms.map((r) => {
      const c = roomColors[r.room] ?? "#888";
      const icon = roomIcons[r.room] ?? "●";
      const ok = r.routeOk && r.apiOk;
      const statusLabel = ok ? "LIVE" : r.routeOk ? "API DOWN" : "OFFLINE";
      const statusColor = ok ? "#00ff88" : r.routeOk ? "#ffaa00" : "#ff2266";
      return `<a href="${esc(DROPLET_BASE)}/rooms/${r.room}" target="_blank" class="room-card" style="--rc:${c}">
        <div class="rc-head">
          <span class="rc-icon">${icon}</span>
          <span class="rc-dot" style="background:${statusColor}"></span>
        </div>
        <div class="rc-name">${r.room.toUpperCase()}</div>
        <div class="rc-status" style="color:${statusColor}">${statusLabel}</div>
        <div class="rc-meta">Route ${r.routeCode} · API ${r.apiCode} · ${r.latencyMs}ms</div>
      </a>`;
    }).join("\n");

    // Conductor topology from health body
    const conductor = healthBody["conductor"] as Record<string, unknown> | undefined;
    const topo = conductor?.["topology"] as Record<string, unknown> | undefined;
    const engineLayers = (topo?.["engineLayers"] as Array<Record<string, string>> | undefined) ?? [];
    const serverLayers = (topo?.["serverLayers"] as Array<Record<string, string>> | undefined) ?? [];

    const engineRows = engineLayers.map((e) => {
      const st = e["status"] ?? "unknown";
      const stColor = st === "idle" ? "#00ff88" : st === "running" ? "#00ccff" : "#ff2266";
      return `<div class="topo-item"><span class="topo-slot">${esc(String(e["slot"] ?? ""))}</span><span class="topo-name">${esc(String(e["layer"] ?? ""))}</span><span class="topo-status" style="color:${stColor}">${esc(st)}</span></div>`;
    }).join("");

    const serverRows = serverLayers.map((e) => {
      const st = e["status"] ?? "unknown";
      const stColor = st === "idle" ? "#00ff88" : st === "running" ? "#00ccff" : "#ff2266";
      return `<div class="topo-item"><span class="topo-slot">${esc(String(e["slot"] ?? ""))}</span><span class="topo-name">${esc(String(e["layer"] ?? ""))}</span><span class="topo-status" style="color:${stColor}">${esc(st)}</span></div>`;
    }).join("");

    // Bridge state from health
    const bridgeData = healthBody["bridge"] as Record<string, unknown> | undefined;
    const bridgeHealth = bridgeData?.["health"] as Record<string, unknown> | undefined;
    const bridgeServices = bridgeData?.["services"] as Record<string, unknown> | undefined;

    return reply.type("text/html").send(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>KITTY — Glass Cockpit</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#050608;--g1:#0a0d12;--g2:#0f1218;--g3:#161b24;--g4:#1e2430;--g5:#2a3140;--fg:#e0e4ec;--dim:#4a5568;--g:#00ff88;--b:#00ccff;--o:#ff6600;--p:#aa66ff;--pk:#ff2266;--y:#ffaa00;--r:#ff2244}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font-family:'Space Mono',monospace;-webkit-font-smoothing:antialiased;min-height:100vh;overflow-x:hidden}

/* TOPBAR */
.topbar{position:sticky;top:0;z-index:100;background:rgba(5,6,8,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--g3);padding:.8rem 2rem;display:flex;align-items:center;gap:1.5rem}
.topbar-logo{font-family:'Bebas Neue',sans-serif;font-size:1.8rem;letter-spacing:.2em;color:var(--g)}
.topbar-label{font-size:.6rem;letter-spacing:.3em;color:var(--dim);text-transform:uppercase}
.topbar-link{font-family:'Bebas Neue',sans-serif;font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;padding:.35rem .8rem;border:1px solid var(--b);color:var(--b);text-decoration:none}
.topbar-link:hover{border-color:var(--g);color:var(--g)}
.topbar-posture{margin-left:auto;font-family:'Bebas Neue',sans-serif;font-size:1rem;letter-spacing:.12em;padding:.4rem 1.2rem;border:1px solid}
.topbar-posture.ok{color:var(--g);border-color:var(--g);text-shadow:0 0 20px rgba(0,255,136,.3)}
.topbar-posture.warn{color:var(--y);border-color:var(--y);text-shadow:0 0 20px rgba(255,170,0,.3)}
.topbar-posture.crit{color:var(--r);border-color:var(--r);text-shadow:0 0 20px rgba(255,34,68,.3);animation:pulse-crit 1.5s infinite}
@keyframes pulse-crit{0%,100%{opacity:1}50%{opacity:.6}}
.topbar-poll{font-size:.55rem;color:var(--dim);letter-spacing:.1em}

/* MAIN */
.main{max-width:1440px;margin:0 auto;padding:1.5rem 2rem 3rem}

/* KPI ROW */
.kpi-row{display:grid;grid-template-columns:repeat(6,1fr);gap:1rem;margin-bottom:2rem}
.kpi{background:var(--g1);border:1px solid var(--g3);padding:1.2rem;text-align:center;position:relative;overflow:hidden}
.kpi::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px}
.kpi-val{font-family:'Bebas Neue',sans-serif;font-size:clamp(1.4rem,3vw,2rem);line-height:1.1}
.kpi-label{font-size:.5rem;color:var(--dim);letter-spacing:.25em;text-transform:uppercase;margin-top:.4rem}

/* SECTION */
.section{margin-bottom:2rem}
.section-hd{font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.15em;color:var(--dim);margin-bottom:1rem;padding-bottom:.5rem;border-bottom:1px solid var(--g3);display:flex;align-items:center;gap:.8rem}
.section-hd .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}

/* ROOM CARDS */
.room-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:1rem}
.room-card{background:var(--g1);border:1px solid var(--g3);padding:1.5rem;text-align:center;text-decoration:none;color:inherit;display:block;transition:all .3s;position:relative;overflow:hidden}
.room-card::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;opacity:0;transition:opacity .4s;background:radial-gradient(ellipse at 50% 100%,rgba(0,255,136,.06),transparent 70%)}
.room-card:hover{border-color:var(--rc);transform:translateY(-4px);box-shadow:0 0 40px rgba(0,255,136,.08)}.room-card:hover::before{opacity:1}
.rc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:.8rem}
.rc-icon{font-size:2rem;color:var(--rc)}
.rc-dot{width:8px;height:8px;border-radius:50%}
.rc-name{font-family:'Bebas Neue',sans-serif;font-size:1.2rem;letter-spacing:.12em;color:var(--rc);margin-bottom:.3rem}
.rc-status{font-family:'Bebas Neue',sans-serif;font-size:.7rem;letter-spacing:.15em;margin-bottom:.4rem}
.rc-meta{font-size:.5rem;color:var(--dim);letter-spacing:.05em}

/* PANELS GRID */
.panels{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem}
.panel{background:var(--g1);border:1px solid var(--g3);padding:1.2rem;overflow:hidden}
.panel.full{grid-column:1/-1}
.panel-hd{font-family:'Bebas Neue',sans-serif;font-size:.9rem;letter-spacing:.12em;color:var(--dim);margin-bottom:.8rem;display:flex;align-items:center;gap:.6rem}
.panel-hd .dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
.row{display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--g2);font-size:.7rem;gap:.5rem}
.row:last-child{border-bottom:none}
.row .l{color:var(--dim);flex-shrink:0}.row .v{text-align:right;word-break:break-all}

/* TOPO */
.topo-grid{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}
.topo-item{display:flex;align-items:center;gap:.6rem;padding:.3rem .5rem;background:var(--bg);border:1px solid var(--g2);font-size:.65rem}
.topo-slot{font-family:'Bebas Neue',sans-serif;font-size:.8rem;color:var(--dim);min-width:1.2rem;text-align:center}
.topo-name{flex:1;color:#aaa;letter-spacing:.05em}
.topo-status{font-family:'Bebas Neue',sans-serif;font-size:.65rem;letter-spacing:.1em;text-transform:uppercase}

/* LIVE DATA */
.live-section{margin-top:1.5rem}
.live-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.2rem}
.live-card{background:var(--g1);border:1px solid var(--g3);padding:1.2rem;min-height:180px}
.live-card-hd{font-family:'Bebas Neue',sans-serif;font-size:.85rem;letter-spacing:.1em;margin-bottom:.6rem;display:flex;align-items:center;gap:.5rem}
.live-card-hd .dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
.live-val{font-family:'Bebas Neue',sans-serif;font-size:1.6rem;line-height:1.1;margin-bottom:.2rem}
.live-meta{font-size:.55rem;color:var(--dim);letter-spacing:.08em}
.live-rows{margin-top:.6rem}
.mini-row{display:flex;justify-content:space-between;padding:.25rem 0;border-bottom:1px solid var(--g2);font-size:.6rem}
.mini-row:last-child{border-bottom:none}
.mini-row .l{color:var(--dim)}.mini-row .v{color:#ccc}

/* FOOTER */
.ft{text-align:center;padding:2rem 0;font-size:.45rem;color:#111;letter-spacing:.35em;border-top:1px solid var(--g2);margin-top:2rem}

/* LINKS */
.ext-link{display:inline-flex;align-items:center;gap:.4rem;font-size:.6rem;color:var(--b);text-decoration:none;letter-spacing:.05em;padding:.2rem .6rem;border:1px solid var(--g3);transition:all .2s}
.ext-link:hover{border-color:var(--b);background:rgba(0,204,255,.05)}

/* RESPONSIVE */
@media(max-width:1100px){.room-grid{grid-template-columns:repeat(3,1fr)}.kpi-row{grid-template-columns:repeat(3,1fr)}.live-grid{grid-template-columns:1fr 1fr}}
@media(max-width:700px){.room-grid{grid-template-columns:1fr 1fr}.panels{grid-template-columns:1fr}.kpi-row{grid-template-columns:1fr 1fr}.live-grid{grid-template-columns:1fr}.topbar{flex-wrap:wrap;gap:.6rem}}
</style></head><body>

<!-- TOPBAR -->
<div class="topbar">
  <div class="topbar-logo">KITTY</div>
  <div class="topbar-label">GLASS COCKPIT · VXSTATION · <span style="color:${ENV.isLocal ? "var(--b)" : "var(--g)"}">${ENV.mode.toUpperCase()}</span></div>
  <a class="topbar-link" href="${esc(DROPLET_BASE)}/runtime" target="_blank" rel="noreferrer">Open VYRDX TV</a>
  <div class="topbar-posture ${postureClass}">${posture}</div>
  <div class="topbar-env" style="font-size:.55rem;letter-spacing:.15em;color:${ENV.isLocal ? "var(--b)" : "var(--g)"};border:1px solid ${ENV.isLocal ? "var(--b)" : "var(--g)"};padding:.3rem .8rem">${ENV.environment.toUpperCase()} · ${esc(ENV.releaseId.slice(0, 20))}</div>
  <div class="topbar-poll">POLL #${s.pollCount} · <span id="last-poll">${s.polledAt.slice(11, 19)}</span> · AUTO 15s</div>
</div>

<div class="main">

<!-- KPI ROW -->
<div class="kpi-row">
  <div class="kpi"><div class="kpi-val" style="color:${dropletOk ? "var(--g)" : "var(--r)"}">${dropletOk ? "UP" : "DOWN"}</div><div class="kpi-label">Droplet</div><style>.kpi:nth-child(1)::after{background:${dropletOk ? "var(--g)" : "var(--r)"}}</style></div>
  <div class="kpi"><div class="kpi-val" style="color:${dbOk ? "var(--g)" : "var(--r)"}">${dbOk ? "OK" : "FAIL"}</div><div class="kpi-label">Database</div><style>.kpi:nth-child(2)::after{background:${dbOk ? "var(--g)" : "var(--r)"}}</style></div>
  <div class="kpi"><div class="kpi-val" style="color:${asusOk ? "var(--g)" : "var(--y)"}">${asusOk ? "UP" : "DOWN"}</div><div class="kpi-label">ASUS Auth</div><style>.kpi:nth-child(3)::after{background:${asusOk ? "var(--g)" : "var(--y)"}}</style></div>
  <div class="kpi"><div class="kpi-val" style="color:var(--b)">${uptimeStr}</div><div class="kpi-label">Uptime</div><style>.kpi:nth-child(4)::after{background:var(--b)}</style></div>
  <div class="kpi"><div class="kpi-val" style="color:var(--p)">${s.droplet.rooms.filter((r) => r.routeOk && r.apiOk).length}/${s.droplet.rooms.length}</div><div class="kpi-label">Rooms Live</div><style>.kpi:nth-child(5)::after{background:var(--p)}</style></div>
  <div class="kpi"><div class="kpi-val" style="color:var(--o)">${s.droplet.health.latencyMs}ms</div><div class="kpi-label">Latency</div><style>.kpi:nth-child(6)::after{background:var(--o)}</style></div>
</div>

<!-- ROOM STATUS -->
<div class="section">
  <div class="section-hd"><div class="dot" style="background:${allRoomsOk ? "var(--g)" : "var(--y)"}"></div> ROOM STATUS — DROPLET RUNTIME</div>
  <div class="room-grid">${roomCards}</div>
</div>

<!-- INFRASTRUCTURE -->
<div class="section">
  <div class="section-hd"><div class="dot" style="background:var(--b)"></div> INFRASTRUCTURE</div>
  <div class="panels">
    <div class="panel">
      <div class="panel-hd"><div class="dot" style="background:${dropletOk ? "var(--g)" : "var(--r)"}"></div> DROPLET RUNTIME</div>
      <div class="row"><span class="l">URL</span><span class="v"><a href="${esc(DROPLET_BASE)}" target="_blank" class="ext-link">${esc(DROPLET_BASE)}</a></span></div>
      <div class="row"><span class="l">Health</span><span class="v" style="color:${dropletOk ? "var(--g)" : "var(--r)"}">${dropletOk ? "HEALTHY" : "UNREACHABLE"}</span></div>
      <div class="row"><span class="l">HTTP</span><span class="v">${s.droplet.health.code}</span></div>
      <div class="row"><span class="l">Latency</span><span class="v">${s.droplet.health.latencyMs}ms</span></div>
      <div class="row"><span class="l">Database</span><span class="v" style="color:${dbOk ? "var(--g)" : "var(--r)"}">${esc(dbStatus).toUpperCase()}</span></div>
      <div class="row"><span class="l">Uptime</span><span class="v">${uptimeStr}</span></div>
      ${s.droplet.health.error ? `<div class="row"><span class="l">Error</span><span class="v" style="color:var(--r)">${esc(s.droplet.health.error)}</span></div>` : ""}
    </div>
    <div class="panel">
      <div class="panel-hd"><div class="dot" style="background:${asusOk ? "var(--g)" : "var(--y)"}"></div> ASUS AUTHORITY</div>
      <div class="row"><span class="l">URL</span><span class="v"><a href="${esc(ASUS_BASE)}" target="_blank" class="ext-link">${esc(ASUS_BASE)}</a></span></div>
      <div class="row"><span class="l">Health</span><span class="v" style="color:${asusOk ? "var(--g)" : "var(--r)"}">${asusOk ? "HEALTHY" : "UNREACHABLE"}</span></div>
      <div class="row"><span class="l">HTTP</span><span class="v">${s.asus.health.code}</span></div>
      <div class="row"><span class="l">Latency</span><span class="v">${s.asus.health.latencyMs}ms</span></div>
      <div class="row"><span class="l">Service</span><span class="v">${esc(String(asusBody["service"] ?? "-"))}</span></div>
      ${s.asus.health.error ? `<div class="row"><span class="l">Error</span><span class="v" style="color:var(--r)">${esc(s.asus.health.error)}</span></div>` : ""}
    </div>
  </div>
</div>

<!-- DEPLOY STATE -->
<div class="section">
  <div class="section-hd"><div class="dot" style="background:var(--p)"></div> DEPLOY STATE</div>
  <div class="panels">
    <div class="panel full">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem">
        <div><div class="live-meta">MODE</div><div class="live-val" style="color:${ENV.isLocal ? "var(--b)" : "var(--g)"};font-size:1.1rem">${ENV.mode.toUpperCase()}</div></div>
        <div><div class="live-meta">ENVIRONMENT</div><div class="live-val" style="font-size:1.1rem;color:${ENV.isLocal ? "var(--b)" : "var(--g)"}">${ENV.environment.toUpperCase()}</div></div>
        <div><div class="live-meta">COMMIT</div><div class="live-val" style="color:var(--p);font-size:1.1rem">${esc(String(buildBody["commit"] ?? "-"))}</div></div>
        <div><div class="live-meta">BRANCH</div><div class="live-val" style="font-size:1.1rem">${esc(String(buildBody["branch"] ?? "-"))}</div></div>
        <div><div class="live-meta">BUILT AT</div><div class="live-val" style="font-size:1.1rem;color:var(--b)">${esc(String(buildBody["builtAt"] ?? "-"))}</div></div>
        <div><div class="live-meta">RELEASE</div><div class="live-val" style="font-size:1.1rem">${esc(String(buildBody["releaseId"] ?? ENV.releaseId))}</div></div>
      </div>
    </div>
  </div>
</div>

<!-- CEO CONDUCTOR TOPOLOGY -->
<div class="section">
  <div class="section-hd"><div class="dot" style="background:var(--o)"></div> CEO CONDUCTOR — ENGINE + SERVER TOPOLOGY</div>
  <div class="panels">
    <div class="panel">
      <div class="panel-hd"><div class="dot" style="background:var(--g)"></div> ENGINE LAYERS (10)</div>
      <div class="topo-grid">${engineRows || '<div style="color:var(--dim);font-size:.6rem;padding:.5rem">No engine data</div>'}</div>
    </div>
    <div class="panel">
      <div class="panel-hd"><div class="dot" style="background:var(--b)"></div> SERVER LAYERS (10)</div>
      <div class="topo-grid">${serverRows || '<div style="color:var(--dim);font-size:.6rem;padding:.5rem">No server data</div>'}</div>
    </div>
  </div>
</div>

<!-- BRIDGE / VYRDX STATE -->
<div class="section">
  <div class="section-hd"><div class="dot" style="background:var(--y)"></div> VYRDX BRIDGE</div>
  <div class="panels">
    <div class="panel">
      <div class="panel-hd"><div class="dot" style="background:var(--g)"></div> BRIDGE HEALTH</div>
      <div class="row"><span class="l">Score</span><span class="v" style="color:var(--g)">${String(bridgeHealth?.["score"] ?? "-")}</span></div>
      <div class="row"><span class="l">Healthy</span><span class="v">${String(bridgeHealth?.["healthy"] ?? "-")}</span></div>
    </div>
    <div class="panel">
      <div class="panel-hd"><div class="dot" style="background:var(--o)"></div> SERVICES</div>
      <div class="row"><span class="l">Chain Verifier</span><span class="v" style="color:${bridgeServices?.["chainVerifierHealthy"] ? "var(--g)" : "var(--dim)"}">${String(bridgeServices?.["chainVerifierHealthy"] ?? "-")}</span></div>
      <div class="row"><span class="l">Feed Engine</span><span class="v" style="color:${bridgeServices?.["feedEngineConnected"] ? "var(--g)" : "var(--dim)"}">${String(bridgeServices?.["feedEngineConnected"] ?? "-")}</span></div>
      <div class="row"><span class="l">Attestation</span><span class="v" style="color:${bridgeServices?.["attestationValid"] ? "var(--g)" : "var(--dim)"}">${String(bridgeServices?.["attestationValid"] ?? "-")}</span></div>
      <div class="row"><span class="l">RTMP Auth</span><span class="v" style="color:${bridgeServices?.["rtmpAuthRunning"] ? "var(--g)" : "var(--dim)"}">${String(bridgeServices?.["rtmpAuthRunning"] ?? "-")}</span></div>
    </div>
  </div>
</div>

<!-- LIVE ROOM DATA (client-fetched from Droplet APIs) -->
<div class="section live-section">
  <div class="section-hd"><div class="dot" style="background:var(--g)"></div> LIVE ROOM DATA — CLOUD RUNTIME</div>
  <div class="live-grid">
    <div class="live-card">
      <div class="live-card-hd"><div class="dot" style="background:#00ff88"></div> COMMERCIAL</div>
      <div id="comm-data" class="live-rows"><div class="live-meta">Loading...</div></div>
    </div>
    <div class="live-card">
      <div class="live-card-hd"><div class="dot" style="background:#00ccff"></div> OPERATIONS</div>
      <div id="ops-data" class="live-rows"><div class="live-meta">Loading...</div></div>
    </div>
    <div class="live-card">
      <div class="live-card-hd"><div class="dot" style="background:#ff6600"></div> EVIDENCE</div>
      <div id="evi-data" class="live-rows"><div class="live-meta">Loading...</div></div>
    </div>
  </div>
</div>

<!-- QUICK LINKS -->
<div class="section">
  <div class="section-hd"><div class="dot" style="background:var(--dim)"></div> QUICK ACCESS</div>
  <div style="display:flex;flex-wrap:wrap;gap:.6rem">
    <a href="${esc(DROPLET_BASE)}" target="_blank" class="ext-link">↗ VYRDX Landing</a>
    <a href="${esc(DROPLET_BASE)}/rooms/commercial" target="_blank" class="ext-link">↗ Commercial Room</a>
    <a href="${esc(DROPLET_BASE)}/rooms/operations" target="_blank" class="ext-link">↗ Operations Room</a>
    <a href="${esc(DROPLET_BASE)}/rooms/evidence" target="_blank" class="ext-link">↗ Evidence Room</a>
    <a href="${esc(DROPLET_BASE)}/rooms/camps" target="_blank" class="ext-link">↗ Camps Room</a>
    <a href="${esc(DROPLET_BASE)}/rooms/policy" target="_blank" class="ext-link">↗ Policy Room</a>
    <a href="${esc(DROPLET_BASE)}/health" target="_blank" class="ext-link">↗ Health API</a>
    <a href="${esc(DROPLET_BASE)}/api/build" target="_blank" class="ext-link">↗ Build API</a>
    <a href="${esc(ASUS_BASE)}/health" target="_blank" class="ext-link">↗ ASUS Health</a>
    <a href="/api/monitor" class="ext-link">↗ Monitor JSON</a>
  </div>
</div>

<div class="ft">KITTY · VXSTATION · GLASS COCKPIT · ${ENV.mode.toUpperCase()} · ${ENV.environment.toUpperCase()} · VYRDON PROTOCOL · ${new Date().getFullYear()}</div>
</div>

<script>
const BASE='${esc(DROPLET_BASE)}';
function mr(l,v,c){return '<div class="mini-row"><span class="l">'+l+'</span><span class="v"'+(c?' style="color:'+c+'"':'')+'>'+v+'</span></div>'}
function fmtD(v){return '$'+parseFloat(v||'0').toFixed(2)}

async function loadLive(){
  try{
    const[comm,ops,evi]=await Promise.all([
      fetch(BASE+'/api/commercial/summary').then(r=>r.ok?r.json():null).catch(()=>null),
      fetch(BASE+'/api/operations/summary').then(r=>r.ok?r.json():null).catch(()=>null),
      fetch(BASE+'/api/evidence/summary').then(r=>r.ok?r.json():null).catch(()=>null),
    ]);
    if(comm){
      var rev=comm.revenue||{},cst=comm.customers||{},usg=comm.usage||{};
      document.getElementById('comm-data').innerHTML=
        mr('MRR',fmtD(rev.mrr),'#00ff88')+mr('ARR',fmtD(rev.arr),'#00ff88')+
        mr('Active Customers',cst.active||0)+mr('Churned',cst.churned||0,'#ff2266')+
        mr('Executions',usg.totalExecutions||0,'#00ccff')+mr('Success Rate',(usg.successRate||0)+'%')+
        mr('Unpaid',fmtD(rev.unpaid),'#ffaa00')+mr('Overdue',fmtD(rev.overdue),'#ff2266');
    }else{document.getElementById('comm-data').innerHTML=mr('Status','NO DATA','#333')}
    if(ops){
      var sv=ops.services||{},rt=ops.runtime||{};
      document.getElementById('ops-data').innerHTML=
        mr('APIs',sv.total_services||0)+mr('Healthy',sv.healthy||0,'#00ff88')+mr('Degraded',sv.degraded||0,'#ffaa00')+
        mr('Deploys',ops.deployments?.total||0)+mr('Active Incidents',ops.incidents?.active||0,'#ff2266')+
        mr('Jobs Running',ops.jobs?.running||0,'#00ccff')+mr('Jobs Failed',ops.jobs?.failed||0,'#ff2266')+
        mr('Memory RSS',((rt.memory_rss_mb||0)).toFixed(1)+'MB');
    }else{document.getElementById('ops-data').innerHTML=mr('Status','NO DATA','#333')}
    if(evi){
      var ch=evi.chain||{},ev=evi.events||{};
      document.getElementById('evi-data').innerHTML=
        mr('Total Events',ev.total||0)+mr('Signed',ev.signed||0,'#00ff88')+mr('Verified',ev.verified||0,'#00ccff')+
        mr('Chain Length',ch.length||0)+mr('Chain OK',ch.intact?'YES':'NO',ch.intact?'#00ff88':'#ff2266')+
        mr('Head Hash',(ch.head_hash||'-').slice(0,16)+'...');
    }else{document.getElementById('evi-data').innerHTML=mr('Status','NO DATA','#333')}
  }catch(e){console.error('Live fetch error',e)}
}

async function refreshPosture(){
  try{
    const m=await fetch('/api/monitor').then(r=>r.json());
    document.getElementById('last-poll').textContent=m.polledAt.slice(11,19);
  }catch(e){}
}

loadLive();
setInterval(loadLive,15000);
setInterval(refreshPosture,15000);
<\/script>
</body></html>`);
  });
}
