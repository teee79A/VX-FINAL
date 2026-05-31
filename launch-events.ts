import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";

function toLaunchEvidenceStamp(value: string): string {
  if (value.startsWith("evd_launch_")) return value;
  const short = value.replace(/[^a-f0-9]/gi, "").slice(0, 24) || "000000000000000000000000";
  return `evd_launch_${short}`;
}


export type VyrdxLaunchRoomId = "launch-runtime" | "launch-revenue" | "launch-feedback";

export type VyrdxLaunchEventType =
  | "scan"
  | "reply"
  | "booked"
  | "gate_evaluated"
  | "config_missing"
  | "config_ready"
  | "iq_scored"
  | "q201_state_changed"
  | "crm_synced"
  | "proposal_sent"
  | "payment_requested"
  | "payment_created"
  | "payment_paid"
  | "deploy_started"
  | "deploy_failed"
  | "feedback_received";

export type VyrdxLaunchEventStatus =
  | "received"
  | "allowed"
  | "blocked"
  | "ready"
  | "missing"
  | "queued"
  | "sent"
  | "paid"
  | "started"
  | "failed";

export interface VyrdxLaunchEventInput {
  type: VyrdxLaunchEventType;
  room?: VyrdxLaunchRoomId;
  source: string;
  actor?: string;
  status: VyrdxLaunchEventStatus;
  reason?: string;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}

export interface VyrdxLaunchEvent extends VyrdxLaunchEventInput {
  id: string;
  room: VyrdxLaunchRoomId;
  occurredAt: string;
  actor: string;
  payload: Record<string, unknown>;
  evidenceStamp: string;
  evidencePath: string;
}

export interface VyrdxLaunchRoomState {
  room: VyrdxLaunchRoomId;
  title: string;
  counts: Record<string, number>;
  lastEvents: VyrdxLaunchEvent[];
  failureQueue: VyrdxLaunchEvent[];
  blockedReasons: Array<{ reason: string; count: number }>;
  evidenceLinks: Array<{ eventId: string; evidenceStamp: string; evidencePath: string }>;
}

export const LAUNCH_ROOMS: Record<VyrdxLaunchRoomId, { title: string; eventTypes: VyrdxLaunchEventType[] }> = {
  "launch-runtime": {
    title: "Launch Runtime",
    eventTypes: [
      "scan",
      "gate_evaluated",
      "config_missing",
      "config_ready",
      "iq_scored",
      "q201_state_changed",
      "deploy_started",
      "deploy_failed",
    ],
  },
  "launch-revenue": {
    title: "Launch Revenue",
    eventTypes: [
      "crm_synced",
      "proposal_sent",
      "payment_requested",
      "payment_created",
      "payment_paid",
      "gate_evaluated",
      "config_missing",
      "config_ready",
    ],
  },
  "launch-feedback": {
    title: "Launch Feedback",
    eventTypes: ["reply", "booked", "feedback_received"],
  },
};

const VALID_EVENT_TYPES = new Set<VyrdxLaunchEventType>(
  Object.values(LAUNCH_ROOMS).flatMap((room) => room.eventTypes),
);
const VALID_ROOMS = new Set<VyrdxLaunchRoomId>(Object.keys(LAUNCH_ROOMS) as VyrdxLaunchRoomId[]);
const FAILURE_STATUSES = new Set<VyrdxLaunchEventStatus>(["blocked", "failed"]);

let cachedEvents: VyrdxLaunchEvent[] | null = null;
let cachedSignature: { size: number; mtimeMs: number } | null = null;

function readSignature(path: string): { size: number; mtimeMs: number } | null {
  try {
    const stat = statSync(path);
    return { size: stat.size, mtimeMs: stat.mtimeMs };
  } catch {
    return null;
  }
}

export function isVyrdxLaunchEventType(value: unknown): value is VyrdxLaunchEventType {
  return typeof value === "string" && VALID_EVENT_TYPES.has(value as VyrdxLaunchEventType);
}

export function isVyrdxLaunchRoomId(value: unknown): value is VyrdxLaunchRoomId {
  return typeof value === "string" && VALID_ROOMS.has(value as VyrdxLaunchRoomId);
}

export function defaultLaunchRoomForEvent(type: VyrdxLaunchEventType): VyrdxLaunchRoomId {
  if (type === "reply" || type === "booked" || type === "feedback_received") return "launch-feedback";
  if (
    type === "crm_synced"
    || type === "proposal_sent"
    || type === "payment_requested"
    || type === "payment_created"
    || type === "payment_paid"
  ) {
    return "launch-revenue";
  }
  return "launch-runtime";
}

export function getLaunchEventLogPath(): string {
  return process.env["VYRDX_LAUNCH_EVENT_LOG"]?.trim()
    || join(process.cwd(), "state", "vyrdx-launch", "events.jsonl");
}

export function loadLaunchEvents(): VyrdxLaunchEvent[] {
  const logPath = getLaunchEventLogPath();
  const signature = readSignature(logPath);

  if (cachedEvents !== null && signature && cachedSignature) {
    if (signature.size === cachedSignature.size && signature.mtimeMs === cachedSignature.mtimeMs) {
      return cachedEvents;
    }
  }

  if (!signature || !existsSync(logPath)) {
    cachedEvents = [];
    cachedSignature = null;
    return cachedEvents;
  }

  cachedEvents = readFileSync(logPath, "utf-8")
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as VyrdxLaunchEvent];
      } catch {
        return [];
      }
    });
  cachedSignature = signature;
  return cachedEvents;
}

export function recordLaunchEvent(input: VyrdxLaunchEventInput): VyrdxLaunchEvent {
  const evidencePath = getLaunchEventLogPath();
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const room = input.room ?? defaultLaunchRoomForEvent(input.type);
  const actor = input.actor ?? "system:vyrdx-launch";
  const payload = input.payload ?? {};
  const id = `launch_evt_${randomUUID()}`;
  const evidenceStamp = buildEvidenceStamp({ id, type: input.type, room, source: input.source, status: input.status, occurredAt, payload });

  const priorEvents = loadLaunchEvents();
  const event: VyrdxLaunchEvent = {
    id,
    type: input.type,
    room,
    source: input.source,
    actor,
    status: input.status,
    payload,
    occurredAt,
    evidenceStamp,
    evidencePath,
  };
  if (input.reason) event.reason = input.reason;

  mkdirSync(dirname(evidencePath), { recursive: true });
  appendFileSync(evidencePath, `${JSON.stringify(event)}\n`, { encoding: "utf-8" });
  cachedEvents = [...priorEvents, event];
  cachedSignature = readSignature(evidencePath);
  return event;
}

export function getLaunchRoomState(room: VyrdxLaunchRoomId): VyrdxLaunchRoomState {
  const events = loadLaunchEvents().filter((event) => event.room === room);
  const counts = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.type] = (acc[event.type] ?? 0) + 1;
    return acc;
  }, {});
  const failureQueue = events
    .filter((event) => FAILURE_STATUSES.has(event.status) || event.type === "deploy_failed")
    .slice(-25)
    .reverse();
  const reasonCounts = failureQueue.reduce<Record<string, number>>((acc, event) => {
    const reason = event.reason ?? event.status;
    acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});

  return {
    room,
    title: LAUNCH_ROOMS[room].title,
    counts,
    lastEvents: events.slice(-10).reverse(),
    failureQueue,
    blockedReasons: Object.entries(reasonCounts).map(([reason, count]) => ({ reason, count })),
    evidenceLinks: events.slice(-10).reverse().map((event) => ({
      eventId: event.id,
      evidenceStamp: toLaunchEvidenceStamp(String(event.evidenceStamp)),
      evidencePath: event.evidencePath,
    })),
  };
}

export function getAllLaunchRoomStates(): VyrdxLaunchRoomState[] {
  return (Object.keys(LAUNCH_ROOMS) as VyrdxLaunchRoomId[]).map(getLaunchRoomState);
}

export function renderLaunchRoomHtml(room: VyrdxLaunchRoomId): string {
  const state = getLaunchRoomState(room);
  const countRows = Object.entries(state.counts)
    .map(([type, count]) => `<li><strong>${escapeHtml(type)}</strong><span>${count}</span></li>`)
    .join("");
  const lastRows = state.lastEvents
    .map((event) => `<li><span>${escapeHtml(event.type)}</span><span>${escapeHtml(event.status)}</span><code>${escapeHtml(event.evidenceStamp)}</code></li>`)
    .join("");
  const failures = state.failureQueue
    .map((event) => `<li><span>${escapeHtml(event.reason ?? event.status)}</span><code>${escapeHtml(event.evidenceStamp)}</code></li>`)
    .join("");
  const reasons = state.blockedReasons
    .map((item) => `<li><strong>${escapeHtml(item.reason)}</strong><span>${item.count}</span></li>`)
    .join("");
  const links = state.evidenceLinks
    .map((link) => `<li><code>${escapeHtml(link.evidenceStamp)}</code><span>${escapeHtml(link.evidencePath)}</span></li>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(state.title)} - VYRDX</title>
  <style>
    body{margin:0;background:#0b0d10;color:#eef2f6;font-family:Inter,Arial,sans-serif}
    main{max-width:1120px;margin:0 auto;padding:32px}
    h1{font-size:28px;margin:0 0 20px}
    section{border:1px solid #26313c;margin:16px 0;padding:16px;background:#11161c}
    h2{font-size:14px;text-transform:uppercase;letter-spacing:0;margin:0 0 12px;color:#8fd3ff}
    ul{list-style:none;padding:0;margin:0;display:grid;gap:8px}
    li{display:flex;justify-content:space-between;gap:14px;border-bottom:1px solid #1e2833;padding:8px 0}
    code{color:#9dffbd}
    span{overflow-wrap:anywhere}
  </style>
</head>
<body>
  <main data-room="${escapeHtml(room)}">
    <h1>${escapeHtml(state.title)}</h1>
    <section id="counts"><h2>Counts</h2><ul>${countRows || "<li><span>No events</span><span>0</span></li>"}</ul></section>
    <section id="last-events"><h2>Last Events</h2><ul>${lastRows || "<li><span>No events received</span></li>"}</ul></section>
    <section id="failure-queue"><h2>Failure Queue</h2><ul>${failures || "<li><span>No failures</span></li>"}</ul></section>
    <section id="blocked-reasons"><h2>Blocked Reasons</h2><ul>${reasons || "<li><span>No blocked reasons</span></li>"}</ul></section>
    <section id="evidence-links"><h2>Evidence Links</h2><ul>${links || "<li><span>No evidence stamps</span></li>"}</ul></section>
  </main>
</body>
</html>`;
}

export function resetLaunchEventsForTest(): void {
  cachedEvents = null;
  cachedSignature = null;
  const logPath = getLaunchEventLogPath();
  if (existsSync(logPath)) unlinkSync(logPath);
}

function buildEvidenceStamp(payload: Record<string, unknown>): string {
  const digest = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24);
  return `evd_launch_${digest}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
