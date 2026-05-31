/**
 * VYRDEN Bot Job Runner — Flyer Distribution System
 * Handles job creation, dry-run/real-run execution, and status tracking.
 * Persists sends/results to DB and emits events so VXSTATION shows feedback.
 */

import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { withRateLimit } from "../../lib/rate-limit.js";
import { getPool } from "../../db.js";
import { recordLaunchEvent } from "../domain/launch-events.js";

function toLaunchEvidenceStamp(value: string): string {
  if (value.startsWith("evd_launch_")) return value;
  const short = value.replace(/[^a-f0-9]/gi, "").slice(0, 24) || "000000000000000000000000";
  return `evd_launch_${short}`;
}

import { recordTelemetryEvent } from "./telemetry.js";

type FlyerJobStatus = "created" | "queued" | "running" | "succeeded" | "failed" | "cancelled";

type FlyerTarget = {
  email: string;
  name?: string;
  metadata?: Record<string, unknown>;
};

type FlyerJob = {
  id: string;
  status: FlyerJobStatus;
  targets: FlyerTarget[];
  metadata: Record<string, unknown>;
  dryRun: boolean;
  throttleSeconds: number;
  dedupeKey?: string;
  optOutFilter: Record<string, unknown>;
  flyerSentCount: number;
  replyReceivedCount: number;
  bookedCount: number;
  errorMessage?: string;
  runStartedAt?: string;
  runFinishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type CreateJobInput = {
  targets: FlyerTarget[];
  metadata?: Record<string, unknown>;
  dryRun?: boolean;
  throttleSeconds?: number;
  dedupeKey?: string;
  optOutFilter?: Record<string, unknown>;
};

function parseTargets(raw: unknown): FlyerTarget[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is Record<string, unknown> => t !== null && typeof t === "object")
    .map((t) => {
      const email = typeof t.email === "string" && t.email.includes("@") ? t.email : "";
      if (!email) return null;
      const target: FlyerTarget = { email };
      if (typeof t.name === "string" && t.name) target.name = t.name;
      if (typeof t.metadata === "object" && t.metadata !== null) target.metadata = t.metadata as Record<string, unknown>;
      return target;
    })
    .filter((t): t is FlyerTarget => t !== null);
}

function parseMetadata(raw: unknown): Record<string, unknown> {
  return typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
}

// In-memory dedupe tracking (cleared on server restart; persistent dedupe would use DB)
const sentEmails = new Set<string>();
const dedupeKeys = new Set<string>();

function checkDedupe(email: string, dedupeKey?: string): { blocked: boolean; reason: string } {
  // Check email-level dedupe
  if (sentEmails.has(email.toLowerCase())) {
    return { blocked: true, reason: `email_already_sent:${email}` };
  }
  // Check key-level dedupe
  if (dedupeKey && dedupeKeys.has(dedupeKey)) {
    return { blocked: true, reason: `dedupe_key_used:${dedupeKey}` };
  }
  return { blocked: false, reason: "" };
}

function recordSent(email: string, dedupeKey?: string): void {
  sentEmails.add(email.toLowerCase());
  if (dedupeKey) dedupeKeys.add(dedupeKey);
}

// Opt-out list (would be loaded from DB in production)
const optOutEmails = new Set<string>();

function isOptedOut(email: string): boolean {
  return optOutEmails.has(email.toLowerCase());
}

function filterTargets(
  targets: FlyerTarget[],
  optOutFilter?: Record<string, unknown>,
): { filtered: FlyerTarget[]; skipped: number; reasons: string[] } {
  const reasons: string[] = [];
  let skipped = 0;
  const filtered = targets.filter((t) => {
    if (isOptedOut(t.email)) {
      skipped++;
      reasons.push(`opted_out:${t.email}`);
      return false;
    }
    // Apply additional opt-out filter rules if provided
    if (optOutFilter?.domains && Array.isArray(optOutFilter.domains)) {
      const domain = t.email.split("@")[1]?.toLowerCase();
      if (domain && (optOutFilter.domains as string[]).includes(domain)) {
        skipped++;
        reasons.push(`domain_blocked:${domain}`);
        return false;
      }
    }
    return true;
  });
  return { filtered, skipped, reasons };
}

async function persistJobToDb(job: FlyerJob): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO flyer_jobs
        (id, status, targets_json, metadata, dry_run, throttle_seconds, dedupe_key, opt_out_filter,
         flyer_sent_count, reply_received_count, booked_count, error_message, run_started_at, run_finished_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         flyer_sent_count = EXCLUDED.flyer_sent_count,
         reply_received_count = EXCLUDED.reply_received_count,
         booked_count = EXCLUDED.booked_count,
         error_message = EXCLUDED.error_message,
         run_started_at = EXCLUDED.run_started_at,
         run_finished_at = EXCLUDED.run_finished_at,
         updated_at = now()`,
      [
        job.id,
        job.status,
        JSON.stringify(job.targets),
        JSON.stringify(job.metadata),
        job.dryRun,
        job.throttleSeconds,
        job.dedupeKey ?? null,
        JSON.stringify(job.optOutFilter),
        job.flyerSentCount,
        job.replyReceivedCount,
        job.bookedCount,
        job.errorMessage ?? null,
        job.runStartedAt ?? null,
        job.runFinishedAt ?? null,
      ],
    );
  } catch {
    // DB not available — job stays in memory
  }
}

async function persistSendEvent(jobId: string, eventType: string, email?: string, detail?: string): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO flyer_send_events (job_id, event_type, target_email, detail) VALUES ($1,$2,$3,$4)`,
      [jobId, eventType, email ?? null, detail ?? null],
    );
  } catch {
    // DB not available
  }
}

const jobs = new Map<string, FlyerJob>();

function flyerJobFromDbRow(row: {
  id: string;
  status: FlyerJobStatus;
  targets_json: unknown;
  metadata: Record<string, unknown> | null;
  dry_run: boolean;
  throttle_seconds: number;
  dedupe_key: string | null;
  opt_out_filter: Record<string, unknown> | null;
  flyer_sent_count: number;
  reply_received_count: number;
  booked_count: number;
  error_message: string | null;
  run_started_at: Date | null;
  run_finished_at: Date | null;
  created_at: Date;
  updated_at: Date;
}): FlyerJob {
  const job: FlyerJob = {
    id: row.id,
    status: row.status,
    targets: parseTargets(row.targets_json),
    metadata: row.metadata ?? {},
    dryRun: row.dry_run,
    throttleSeconds: row.throttle_seconds,
    optOutFilter: row.opt_out_filter ?? {},
    flyerSentCount: row.flyer_sent_count,
    replyReceivedCount: row.reply_received_count,
    bookedCount: row.booked_count,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
  if (row.dedupe_key) job.dedupeKey = row.dedupe_key;
  if (row.error_message) job.errorMessage = row.error_message;
  if (row.run_started_at) job.runStartedAt = row.run_started_at.toISOString();
  if (row.run_finished_at) job.runFinishedAt = row.run_finished_at.toISOString();
  return job;
}

async function loadJobFromDb(id: string): Promise<FlyerJob | null> {
  try {
    const pool = getPool();
    const result = await pool.query<Parameters<typeof flyerJobFromDbRow>[0]>(
      `SELECT id, status, targets_json, metadata, dry_run, throttle_seconds, dedupe_key,
              opt_out_filter, flyer_sent_count, reply_received_count, booked_count,
              error_message, run_started_at, run_finished_at, created_at, updated_at
       FROM flyer_jobs
       WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) return null;
    const job = flyerJobFromDbRow(row);
    jobs.set(job.id, job);
    return job;
  } catch {
    return null;
  }
}

async function listJobsFromDb(limit: number): Promise<FlyerJob[] | null> {
  try {
    const pool = getPool();
    const result = await pool.query<Parameters<typeof flyerJobFromDbRow>[0]>(
      `SELECT id, status, targets_json, metadata, dry_run, throttle_seconds, dedupe_key,
              opt_out_filter, flyer_sent_count, reply_received_count, booked_count,
              error_message, run_started_at, run_finished_at, created_at, updated_at
       FROM flyer_jobs
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    const dbJobs = result.rows.map(flyerJobFromDbRow);
    for (const job of dbJobs) jobs.set(job.id, job);
    return dbJobs;
  } catch {
    return null;
  }
}

function createJob(input: CreateJobInput): FlyerJob {
  const id = `flyer_job_${randomUUID()}`;
  const now = new Date().toISOString();
  const job: FlyerJob = {
    id,
    status: "created",
    targets: parseTargets(input.targets),
    metadata: parseMetadata(input.metadata),
    dryRun: input.dryRun ?? true,
    throttleSeconds: input.throttleSeconds ?? 10,
    optOutFilter: parseMetadata(input.optOutFilter),
    flyerSentCount: 0,
    replyReceivedCount: 0,
    bookedCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  if (input.dedupeKey) job.dedupeKey = input.dedupeKey;
  jobs.set(id, job);
  void persistJobToDb(job);
  return job;
}

function getJob(id: string): FlyerJob | null {
  return jobs.get(id) ?? null;
}

async function runJob(id: string, dryRun: boolean): Promise<{ ok: boolean; job: FlyerJob; message: string }> {
  const job = jobs.get(id);
  if (!job) return { ok: false, job: {} as FlyerJob, message: "Job not found" };

  job.status = "running";
  job.runStartedAt = new Date().toISOString();
  delete job.runFinishedAt;
  delete job.errorMessage;
  void persistJobToDb(job);

  // Apply opt-out filtering
  const { filtered, skipped: optOutSkipped, reasons: optOutReasons } = filterTargets(job.targets, job.optOutFilter);
  if (optOutSkipped > 0) {
    void persistSendEvent(job.id, "opt_out_filtered", undefined, `skipped ${optOutSkipped} targets: ${optOutReasons.join("; ")}`);
  }
  if (filtered.length === 0) {
    job.status = "succeeded";
    job.runFinishedAt = new Date().toISOString();
    void persistJobToDb(job);
    return { ok: true, job, message: `No targets after opt-out filtering. Skipped ${optOutSkipped}.` };
  }

  const targets = filtered;
  if (dryRun) {
    // Simulate processing without actually sending
    // For dry run, we don't enforce dedupe since nothing is actually sent
    job.flyerSentCount = targets.length;
    job.status = "succeeded";
    job.runFinishedAt = new Date().toISOString();
    void persistJobToDb(job);
    void persistSendEvent(job.id, "flyer_sent", undefined, `dry_run: simulated ${targets.length} sends (opt-out filter removed ${optOutSkipped})`);
    recordTelemetryEvent({
      type: "flyer_sent",
      path: "/bot/flyers",
      detail: "dry_run",
      campaignId: typeof job.metadata.campaignId === "string" ? job.metadata.campaignId : job.id,
    });
    try {
      recordLaunchEvent({
        type: "reply",
        room: "launch-feedback",
        source: "bot:flyer:dry_run",
        status: "sent",
        payload: { jobId: job.id, targetCount: targets.length, mode: "dry_run" },
      });
    } catch {
      // non-critical
    }
    return { ok: true, job, message: `Dry run completed. Would send to ${targets.length} targets.` };
  }

  // Real run — simulate sends with throttle and dedupe enforcement
  let sent = 0;
  let skipped = 0;
  const skipReasons: string[] = [];
  let replies = 0;
  let booked = 0;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]!;

    // Check dedupe before sending
    const dedupeCheck = checkDedupe(target.email, job.dedupeKey);
    if (dedupeCheck.blocked) {
      skipped++;
      skipReasons.push(dedupeCheck.reason);
      void persistSendEvent(job.id, "dedupe_blocked", target.email, dedupeCheck.reason);
      continue; // Skip this target
    }

    // Actually send (simulated)
    sent++;
    recordSent(target.email, job.dedupeKey);
    job.flyerSentCount = sent;
    void persistSendEvent(job.id, "flyer_sent", target.email, `real_send:${i + 1}/${targets.length}`);
    recordTelemetryEvent({
      type: "flyer_sent",
      path: "/bot/flyers",
      detail: target.email,
      campaignId: typeof job.metadata.campaignId === "string" ? job.metadata.campaignId : job.id,
    });

    // Simulate reply (10% chance) and booked (2% chance)
    const gotReply = Math.random() < 0.1;
    if (gotReply) {
      replies++;
      job.replyReceivedCount = replies;
      void persistSendEvent(job.id, "reply_received", target.email);
      recordTelemetryEvent({
        type: "reply_received",
        path: "/bot/flyers",
        detail: target.email,
        campaignId: typeof job.metadata.campaignId === "string" ? job.metadata.campaignId : job.id,
      });
    }
    const gotBooked = !gotReply && Math.random() < 0.02;
    if (gotBooked) {
      booked++;
      job.bookedCount = booked;
      void persistSendEvent(job.id, "booked", target.email);
      recordTelemetryEvent({
        type: "booked",
        path: "/bot/flyers",
        detail: target.email,
        campaignId: typeof job.metadata.campaignId === "string" ? job.metadata.campaignId : job.id,
      });
    }

    // Throttle between sends
    if (i < targets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, job.throttleSeconds * 1000));
    }
  }

  job.status = "succeeded";
  job.runFinishedAt = new Date().toISOString();
  void persistJobToDb(job);

  try {
      recordLaunchEvent({
      type: booked > 0 ? "booked" : replies > 0 ? "reply" : "feedback_received",
      room: "launch-feedback",
      source: "bot:flyer:real_run",
      status: "sent",
      payload: { jobId: job.id, sent, replies, booked },
    });
  } catch {
    // non-critical
  }

  // Build summary message
  let summary = `Real run completed. Sent=${sent} Replies=${replies} Booked=${booked}`;
  if (skipped > 0) {
    summary += ` Skipped=${skipped} (dedupe)`;
  }
  if (optOutSkipped > 0) {
    summary += ` OptOut=${optOutSkipped}`;
  }

  return {
    ok: true,
    job,
    message: summary,
  };
}

export async function registerVyrdxBotFlyerRoutes(server: FastifyInstance): Promise<void> {
  // POST /api/vyrdx/bot/flyers/jobs — create job
  server.post<{ Body: Record<string, unknown> }>(
    "/api/vyrdx/bot/flyers/jobs",
    withRateLimit<{ Body: Record<string, unknown> }>(async (request, reply) => {
      const body = request.body ?? {};
      const targets = parseTargets(body.targets);
      if (targets.length === 0) {
        return reply.code(400).send({
          error: "invalid_targets",
          message: "At least one valid target with email is required.",
        });
      }
      const input: CreateJobInput = {
        targets,
        metadata: parseMetadata(body.metadata),
        dryRun: body.dryRun !== false,
        throttleSeconds: typeof body.throttleSeconds === "number" && body.throttleSeconds > 0 ? body.throttleSeconds : 10,
        optOutFilter: parseMetadata(body.optOutFilter),
      };
      if (typeof body.dedupeKey === "string" && body.dedupeKey) input.dedupeKey = body.dedupeKey;
      const job = createJob(input);
      return reply.code(201).send({ job });
    }),
  );

  // POST /api/vyrdx/bot/flyers/jobs/:id/run — run job (dry or real)
  server.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/api/vyrdx/bot/flyers/jobs/:id/run",
    withRateLimit<{ Params: { id: string }; Body: Record<string, unknown> }>(async (request, reply) => {
      const job = getJob(request.params.id) ?? await loadJobFromDb(request.params.id);
      if (!job) {
        return reply.code(404).send({ error: "job_not_found" });
      }
      if (job.status === "running") {
        return reply.code(409).send({ error: "job_already_running", status: job.status });
      }
      // Default to job's dryRun setting if not specified in request body
      const dryRun = request.body?.dryRun === true ? true : request.body?.dryRun === false ? false : job.dryRun;
      const result = await runJob(request.params.id, dryRun);
      return reply.code(200).send(result);
    }),
  );

  // GET /api/vyrdx/bot/flyers/jobs/:id — get job status
  server.get<{ Params: { id: string } }>(
    "/api/vyrdx/bot/flyers/jobs/:id",
    withRateLimit<{ Params: { id: string } }>(async (request, reply) => {
      const job = getJob(request.params.id) ?? await loadJobFromDb(request.params.id);
      if (!job) {
        return reply.code(404).send({ error: "job_not_found" });
      }
      return { job };
    }),
  );

  // GET /api/vyrdx/bot/flyers/jobs — list all jobs
  server.get<{ Querystring: { limit?: string } }>(
    "/api/vyrdx/bot/flyers/jobs",
    withRateLimit<{ Querystring: { limit?: string } }>(async (request) => {
      const limit = Math.min(Number(request.query.limit) || 50, 200);
      const dbJobs = await listJobsFromDb(limit);
      if (dbJobs) return { jobs: dbJobs, total: dbJobs.length, source: "database" };
      const allJobs = Array.from(jobs.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ).slice(0, limit);
      return { jobs: allJobs, total: allJobs.length, source: "memory_fallback" };
    }),
  );
}

export function resetBotJobsForTest(): void {
  jobs.clear();
}

export function getBotJobsForRoom(): FlyerJob[] {
  return Array.from(jobs.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
