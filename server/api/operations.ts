/**
 * Operations Room — API Surface
 *
 * All /api/operations/* endpoints.
 * Backed by Postgres: service_status, deployments, incidents, job_runs.
 * Also exposes live runtime metrics from process stats.
 */

import type { FastifyInstance } from "fastify";
import { query, queryOne, dbHealthy } from "../db.js";
import { getPhase2OpsSupportStatus, isPhase2SliceEnabled } from "../lib/phase2-slice.js";

// ── TYPES ─────────────────────────────────────────────────────────────────

interface ServiceStatusRow {
  id: string;
  service_name: string;
  environment: string;
  status: string;
  detail: Record<string, unknown>;
  checked_at: string;
}

interface DeploymentRow {
  id: string;
  environment: string;
  release_id: string;
  git_commit: string;
  build_time: string | null;
  operator: string | null;
  status: string;
  detail: Record<string, unknown>;
  created_at: string;
}

interface IncidentRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  summary: string;
  owner: string | null;
  opened_at: string;
  resolved_at: string | null;
}

interface JobRunRow {
  id: string;
  customer_id: string | null;
  job_type: string;
  status: string;
  detail: Record<string, unknown>;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

// ── REGISTER ──────────────────────────────────────────────────────────────

export async function registerOperationsRoutes(server: FastifyInstance): Promise<void> {

  // GET /api/operations/summary
  server.get("/api/operations/summary", async (req, reply) => {
    if (!isPhase2SliceEnabled()) {
      return reply.code(503).send({
        error: "phase2_slice_required",
        message: "Ops summary is bound to canonical phase-2 backend and cannot use local fallback.",
      });
    }

    try {
      const phase2Services = await getPhase2OpsSupportStatus();
      const services = {
        healthy: phase2Services.filter((row) => row.status === "healthy").length,
        degraded: phase2Services.filter((row) => row.status === "degraded").length,
        down: phase2Services.filter((row) => row.status === "down").length,
      };

      const mem = process.memoryUsage();
      return {
        source: "phase2",
        uptime: process.uptime(),
        memory: {
          heapUsedMb: Math.round(mem.heapUsed / 1_048_576),
          rss: Math.round(mem.rss / 1_048_576),
        },
        services,
        latestDeploy: null,
        incidents: {
          open: 0,
          mitigating: 0,
        },
        jobs: {
          queued: 0,
          running: 0,
          failed: phase2Services.filter((row) => row.status !== "healthy").length,
          dead: phase2Services.filter((row) => row.status === "down").length,
        },
        phase2Services: phase2Services.map((row) => ({
          service: row.service,
          status: row.status,
          checked_at: row.checkedAt,
          detail_api: `/api/operations/services/${encodeURIComponent(row.service)}`,
          recheck_api: `/api/operations/services/${encodeURIComponent(row.service)}/recheck`,
        })),
      };
    } catch (error) {
      req.log.error({ err: error }, "phase2 operations summary fetch failed");
      return reply.code(503).send({
        error: "phase2_operations_summary_unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/operations/services
  server.get("/api/operations/services", async (req, reply) => {
    if (!isPhase2SliceEnabled()) {
      return reply.code(503).send({
        error: "phase2_slice_required",
        message: "Ops service status is bound to canonical phase-2 backend and cannot use local fallback.",
      });
    }

    try {
      const rows = await getPhase2OpsSupportStatus();
      const services = rows.map((row) => ({
        id: row.service,
        service_name: row.service,
        environment: "phase2",
        status: row.status,
        detail: row.detail,
        checked_at: row.checkedAt,
        status_url: row.statusUrl,
        detail_api: `/api/operations/services/${encodeURIComponent(row.service)}`,
        recheck_api: `/api/operations/services/${encodeURIComponent(row.service)}/recheck`,
        source: "phase2",
      }));
      return { services, source: "phase2" };
    } catch (error) {
      req.log.error({ err: error }, "phase2 operations service list fetch failed");
      return reply.code(503).send({
        error: "phase2_operations_services_unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/operations/services/:serviceName
  server.get<{ Params: { serviceName: string } }>("/api/operations/services/:serviceName", async (req, reply) => {
    const { serviceName } = req.params;

    if (!isPhase2SliceEnabled()) {
      return reply.code(503).send({
        error: "phase2_slice_required",
        message: "Ops service detail is bound to canonical phase-2 backend and cannot use local fallback.",
      });
    }

    try {
      const rows = await getPhase2OpsSupportStatus();
      const match = rows.find((row) => row.service === serviceName);
      if (!match) {
        return reply.code(404).send({ error: "service_not_found" });
      }
      return {
        source: "phase2",
        service: {
          id: match.service,
          service_name: match.service,
          environment: "phase2",
          status: match.status,
          detail: match.detail,
          checked_at: match.checkedAt,
          status_url: match.statusUrl,
          recheck_api: `/api/operations/services/${encodeURIComponent(match.service)}/recheck`,
        },
      };
    } catch (error) {
      req.log.error({ err: error, serviceName }, "phase2 operations service detail fetch failed");
      return reply.code(503).send({
        error: "phase2_operations_service_unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /api/operations/services/:serviceName/recheck
  server.get<{ Params: { serviceName: string } }>("/api/operations/services/:serviceName/recheck", async (req, reply) => {
    const { serviceName } = req.params;
    if (!isPhase2SliceEnabled()) {
      return reply.code(400).send({
        error: "phase2_slice_disabled",
        message: "Recheck is only available when phase-2 slice binding is enabled.",
      });
    }

    try {
      const rows = await getPhase2OpsSupportStatus();
      const match = rows.find((row) => row.service === serviceName);
      if (!match) {
        return reply.code(404).send({ error: "service_not_found" });
      }
      return {
        source: "phase2",
        service: {
          id: match.service,
          service_name: match.service,
          environment: "phase2",
          status: match.status,
          detail: match.detail,
          checked_at: match.checkedAt,
          status_url: match.statusUrl,
        },
      };
    } catch (error) {
      req.log.error({ err: error, serviceName }, "phase2 operations service recheck failed");
      return reply.code(503).send({
        error: "phase2_operations_recheck_unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /api/operations/services/:serviceName/recheck
  server.post<{ Params: { serviceName: string } }>("/api/operations/services/:serviceName/recheck", async (req, reply) => {
    const { serviceName } = req.params;
    if (!isPhase2SliceEnabled()) {
      return reply.code(400).send({
        error: "phase2_slice_disabled",
        message: "Recheck is only available when phase-2 slice binding is enabled.",
      });
    }

    try {
      const rows = await getPhase2OpsSupportStatus();
      const match = rows.find((row) => row.service === serviceName);
      if (!match) {
        return reply.code(404).send({ error: "service_not_found" });
      }
      return {
        source: "phase2",
        service: {
          id: match.service,
          service_name: match.service,
          environment: "phase2",
          status: match.status,
          detail: match.detail,
          checked_at: match.checkedAt,
          status_url: match.statusUrl,
        },
      };
    } catch (error) {
      req.log.error({ err: error, serviceName }, "phase2 operations service recheck failed");
      return reply.code(503).send({
        error: "phase2_operations_recheck_unavailable",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/operations/deployments
  server.get("/api/operations/deployments", async () => {
    const rows = await query<DeploymentRow>(
      "SELECT * FROM deployments ORDER BY created_at DESC LIMIT 50",
    );
    return { deployments: rows };
  });

  // GET /api/operations/runtime
  server.get("/api/operations/runtime", async () => {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const pgOk = await dbHealthy();

    return {
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1_048_576),
        heapTotalMb: Math.round(mem.heapTotal / 1_048_576),
        rssMb: Math.round(mem.rss / 1_048_576),
        externalMb: Math.round(mem.external / 1_048_576),
      },
      cpu: {
        userMs: Math.round(cpu.user / 1000),
        systemMs: Math.round(cpu.system / 1000),
      },
      dependencies: {
        postgres: pgOk ? "connected" : "disconnected",
      },
    };
  });

  // GET /api/operations/incidents
  server.get("/api/operations/incidents", async () => {
    const rows = await query<IncidentRow>(
      "SELECT * FROM incidents ORDER BY opened_at DESC LIMIT 50",
    );
    return { incidents: rows };
  });

  // GET /api/operations/jobs
  server.get("/api/operations/jobs", async () => {
    const rows = await query<JobRunRow>(
      "SELECT * FROM job_runs ORDER BY created_at DESC LIMIT 100",
    );
    return { jobs: rows };
  });

  // GET /api/operations/dependencies
  server.get("/api/operations/dependencies", async () => {
    const pgOk = await dbHealthy();

    let asusOk = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch("https://consolelab.vyrdon.com/health", { signal: controller.signal });
      asusOk = res.ok;
      clearTimeout(timeout);
    } catch { /* unreachable from Droplet */ }

    return {
      postgres: { status: pgOk ? "healthy" : "down" },
      consolelab: { status: asusOk ? "healthy" : "unreachable" },
    };
  });

  // GET /api/operations/metrics
  server.get("/api/operations/metrics", async () => {
    const [deploys, incidents, jobs] = await Promise.all([
      query<Record<string, string>>(`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE status = 'succeeded')::text AS succeeded,
          COUNT(*) FILTER (WHERE status = 'failed')::text AS failed,
          COUNT(*) FILTER (WHERE status = 'rolled_back')::text AS rolled_back,
          CASE WHEN COUNT(*) FILTER (WHERE status = 'succeeded' AND build_time IS NOT NULL) > 0
            THEN ROUND(AVG(EXTRACT(EPOCH FROM (created_at - build_time)))::numeric, 1)::text
            ELSE '0'
          END AS mean_deploy_duration_s
        FROM deployments
      `),
      query<Record<string, string>>(`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE status = 'open')::text AS open,
          COUNT(*) FILTER (WHERE status = 'resolved')::text AS resolved,
          CASE WHEN COUNT(*) FILTER (WHERE resolved_at IS NOT NULL) > 0
            THEN ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - opened_at)))::numeric, 0)::text
            ELSE '0'
          END AS mttr_s
        FROM incidents
      `),
      query<Record<string, string>>(`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE status = 'queued')::text AS queued,
          COUNT(*) FILTER (WHERE status = 'dead')::text AS dead,
          CASE WHEN COUNT(*) > 0
            THEN ROUND(COUNT(*) FILTER (WHERE status = 'failed')::numeric / COUNT(*)::numeric * 100, 1)::text
            ELSE '0'
          END AS failure_rate
        FROM job_runs
      `),
    ]);

    return {
      uptime: process.uptime(),
      deploys: deploys[0],
      incidents: incidents[0],
      jobs: jobs[0],
    };
  });

  // POST /api/operations/incidents
  server.post<{ Body: { title: string; severity: string; summary: string; owner?: string } }>(
    "/api/operations/incidents",
    async (req, reply) => {
      const { title, severity, summary, owner } = req.body as {
        title: string;
        severity: string;
        summary: string;
        owner?: string;
      };
      if (!title || !severity || !summary) {
        return reply.code(400).send({ error: "title, severity, summary required" });
      }
      const valid = ["low", "medium", "high", "critical"];
      if (!valid.includes(severity)) {
        return reply.code(400).send({ error: `severity must be one of: ${valid.join(", ")}` });
      }

      const rows = await query<IncidentRow>(
        `INSERT INTO incidents (title, severity, status, summary, owner)
         VALUES ($1, $2, 'open', $3, $4)
         RETURNING *`,
        [title, severity, summary, owner ?? null],
      );
      return reply.code(201).send(rows[0]);
    },
  );

  // POST /api/operations/incidents/:id/resolve
  server.post<{ Params: { id: string }; Body: { resolution?: string } }>(
    "/api/operations/incidents/:id/resolve",
    async (req, reply) => {
      const { id } = req.params;
      const { resolution } = (req.body as { resolution?: string }) ?? {};

      const incident = await queryOne<IncidentRow>("SELECT * FROM incidents WHERE id = $1", [id]);
      if (!incident) return reply.code(404).send({ error: "Incident not found" });
      if (incident.status === "resolved") return reply.code(400).send({ error: "Already resolved" });

      const rows = await query<IncidentRow>(
        `UPDATE incidents SET status = 'resolved', resolved_at = now(), summary = summary || $2
         WHERE id = $1 RETURNING *`,
        [id, resolution ? ` [RESOLUTION: ${resolution}]` : ""],
      );
      return rows[0];
    },
  );

  // GET /api/operations/jobs/:id
  server.get<{ Params: { id: string } }>("/api/operations/jobs/:id", async (req, reply) => {
    const job = await queryOne<JobRunRow>("SELECT * FROM job_runs WHERE id = $1", [req.params.id]);
    if (!job) return reply.code(404).send({ error: "job_not_found" });
    return {
      job,
      evidence_refs: [
        typeof job.detail?.["evidence_ref"] === "string" ? String(job.detail["evidence_ref"]) : null,
      ].filter(Boolean),
      actions: ["retry", "recheck"],
    };
  });

  // GET /api/operations/incidents/:id
  server.get<{ Params: { id: string } }>("/api/operations/incidents/:id", async (req, reply) => {
    const incident = await queryOne<IncidentRow>("SELECT * FROM incidents WHERE id = $1", [req.params.id]);
    if (!incident) return reply.code(404).send({ error: "incident_not_found" });
    return {
      incident,
      evidence_refs: [],
      actions: ["recheck", "resolve"],
    };
  });

  // GET /api/operations/deployments/:id
  server.get<{ Params: { id: string } }>("/api/operations/deployments/:id", async (req, reply) => {
    const deploy = await queryOne<DeploymentRow>("SELECT * FROM deployments WHERE id = $1", [req.params.id]);
    if (!deploy) return reply.code(404).send({ error: "deployment_not_found" });
    return {
      deployment: deploy,
      canary: {
        result: typeof deploy.detail?.["canary_result"] === "string" ? String(deploy.detail["canary_result"]) : null,
        evidence_ref: typeof deploy.detail?.["canary_evidence_ref"] === "string" ? String(deploy.detail["canary_evidence_ref"]) : null,
      },
      rollback: {
        status: deploy.status === "rolled_back" ? "rolled_back" : "not_rolled_back",
        evidence_ref: typeof deploy.detail?.["rollback_evidence_ref"] === "string" ? String(deploy.detail["rollback_evidence_ref"]) : null,
      },
      actions: ["run_canary", "inspect_rollback"],
    };
  });

  // GET /api/operations/canary-results
  server.get("/api/operations/canary-results", async () => {
    const deploymentRows = await query<{
      id: string;
      release_id: string;
      environment: string;
      status: string;
      detail: Record<string, unknown>;
      created_at: string;
    }>(`
      SELECT id::text AS id,
             release_id,
             environment,
             status,
             detail,
             created_at::text AS created_at
      FROM deployments
      ORDER BY created_at DESC
      LIMIT 200
    `);

    const runtimeRows = await query<{
      service_name: string;
      canary_status: string;
      updated_at: string;
    }>(`
      SELECT service_name,
             COALESCE(canary_status, 'unknown') AS canary_status,
             updated_at::text AS updated_at
      FROM system_runtime_isolation
      ORDER BY updated_at DESC
      LIMIT 100
    `);

    const canaries = [
      ...deploymentRows.map((row) => ({
        id: `deploy:${row.id}`,
        source: "deployments",
        release_id: row.release_id,
        environment: row.environment,
        canary_result: typeof row.detail?.["canary_result"] === "string"
          ? String(row.detail["canary_result"])
          : row.status,
        evidence_ref: typeof row.detail?.["canary_evidence_ref"] === "string"
          ? String(row.detail["canary_evidence_ref"])
          : null,
        captured_at: row.created_at,
      })),
      ...runtimeRows.map((row) => ({
        id: `runtime:${row.service_name}`,
        source: "system_runtime_isolation",
        release_id: null,
        environment: "runtime",
        canary_result: row.canary_status,
        evidence_ref: null,
        captured_at: row.updated_at,
      })),
    ];

    return { canary_results: canaries };
  });

  // GET /api/operations/canary-results/:id
  server.get<{ Params: { id: string } }>("/api/operations/canary-results/:id", async (req, reply) => {
    const id = req.params.id;
    if (id.startsWith("deploy:")) {
      const deployId = id.slice("deploy:".length);
      const deploy = await queryOne<DeploymentRow>("SELECT * FROM deployments WHERE id = $1", [deployId]);
      if (!deploy) return reply.code(404).send({ error: "canary_result_not_found" });
      return {
        canary_result: {
          id,
          source: "deployments",
          deployment_id: deployId,
          status: typeof deploy.detail?.["canary_result"] === "string"
            ? String(deploy.detail["canary_result"])
            : deploy.status,
          detail: deploy.detail,
          evidence_ref: typeof deploy.detail?.["canary_evidence_ref"] === "string"
            ? String(deploy.detail["canary_evidence_ref"])
            : null,
          created_at: deploy.created_at,
        },
        actions: ["run_canary", "recheck"],
      };
    }

    if (id.startsWith("runtime:")) {
      const serviceName = id.slice("runtime:".length);
      const runtime = await queryOne<{
        service_name: string;
        canary_status: string;
        rollback_proof_status: string;
        updated_at: string;
      }>(`
        SELECT service_name,
               COALESCE(canary_status, 'unknown') AS canary_status,
               COALESCE(rollback_proof_status, 'unknown') AS rollback_proof_status,
               updated_at::text AS updated_at
        FROM system_runtime_isolation
        WHERE service_name = $1
        LIMIT 1
      `, [serviceName]);
      if (!runtime) return reply.code(404).send({ error: "canary_result_not_found" });
      return {
        canary_result: {
          id,
          source: "system_runtime_isolation",
          service_name: runtime.service_name,
          status: runtime.canary_status,
          rollback_proof_status: runtime.rollback_proof_status,
          updated_at: runtime.updated_at,
        },
        actions: ["run_canary", "inspect_rollback"],
      };
    }

    return reply.code(404).send({ error: "canary_result_not_found" });
  });

  // GET /api/operations/rollbacks
  server.get("/api/operations/rollbacks", async () => {
    const deployRows = await query<{
      id: string;
      release_id: string;
      environment: string;
      detail: Record<string, unknown>;
      created_at: string;
    }>(`
      SELECT id::text AS id,
             release_id,
             environment,
             detail,
             created_at::text AS created_at
      FROM deployments
      WHERE status = 'rolled_back'
      ORDER BY created_at DESC
      LIMIT 200
    `);

    const runtimeRows = await query<{
      service_name: string;
      rollback_proof_status: string;
      updated_at: string;
    }>(`
      SELECT service_name,
             COALESCE(rollback_proof_status, 'unknown') AS rollback_proof_status,
             updated_at::text AS updated_at
      FROM system_runtime_isolation
      ORDER BY updated_at DESC
      LIMIT 100
    `);

    return {
      rollbacks: [
        ...deployRows.map((row) => ({
          id: `deploy:${row.id}`,
          source: "deployments",
          release_id: row.release_id,
          environment: row.environment,
          status: "rolled_back",
          evidence_ref: typeof row.detail?.["rollback_evidence_ref"] === "string"
            ? String(row.detail["rollback_evidence_ref"])
            : null,
          captured_at: row.created_at,
        })),
        ...runtimeRows.map((row) => ({
          id: `runtime:${row.service_name}`,
          source: "system_runtime_isolation",
          release_id: null,
          environment: "runtime",
          status: row.rollback_proof_status,
          evidence_ref: null,
          captured_at: row.updated_at,
        })),
      ],
    };
  });

  // GET /api/operations/rollbacks/:id
  server.get<{ Params: { id: string } }>("/api/operations/rollbacks/:id", async (req, reply) => {
    const id = req.params.id;
    if (id.startsWith("deploy:")) {
      const deployId = id.slice("deploy:".length);
      const deploy = await queryOne<DeploymentRow>("SELECT * FROM deployments WHERE id = $1", [deployId]);
      if (!deploy) return reply.code(404).send({ error: "rollback_not_found" });
      return {
        rollback: {
          id,
          source: "deployments",
          deployment_id: deployId,
          status: deploy.status,
          detail: deploy.detail,
          evidence_ref: typeof deploy.detail?.["rollback_evidence_ref"] === "string"
            ? String(deploy.detail["rollback_evidence_ref"])
            : null,
          created_at: deploy.created_at,
        },
        actions: ["inspect_rollback", "recheck"],
      };
    }

    if (id.startsWith("runtime:")) {
      const serviceName = id.slice("runtime:".length);
      const runtime = await queryOne<{
        service_name: string;
        rollback_proof_status: string;
        updated_at: string;
      }>(`
        SELECT service_name,
               COALESCE(rollback_proof_status, 'unknown') AS rollback_proof_status,
               updated_at::text AS updated_at
        FROM system_runtime_isolation
        WHERE service_name = $1
        LIMIT 1
      `, [serviceName]);
      if (!runtime) return reply.code(404).send({ error: "rollback_not_found" });
      return {
        rollback: {
          id,
          source: "system_runtime_isolation",
          service_name: runtime.service_name,
          status: runtime.rollback_proof_status,
          updated_at: runtime.updated_at,
        },
        actions: ["inspect_rollback", "recheck"],
      };
    }

    return reply.code(404).send({ error: "rollback_not_found" });
  });

  // POST /api/operations/jobs/:id/retry
  server.post<{ Params: { id: string } }>("/api/operations/jobs/:id/retry", async (req, reply) => {
    const job = await queryOne<JobRunRow>("SELECT * FROM job_runs WHERE id = $1", [req.params.id]);
    if (!job) return reply.code(404).send({ error: "job_not_found" });

    const rows = await query<JobRunRow>(
      `UPDATE job_runs
          SET status = 'retrying',
              detail = COALESCE(detail, '{}'::jsonb) || jsonb_build_object('retry_requested_at', now()::text)
        WHERE id = $1
        RETURNING *`,
      [req.params.id],
    );

    return { ok: true, action: "retry", job: rows[0] };
  });

  // POST /api/operations/canary/run
  server.post<{ Body: { deploymentId?: string; serviceName?: string; requestedBy?: string } }>(
    "/api/operations/canary/run",
    async (req) => {
      const requestedBy = (req.body?.requestedBy ?? "operator").trim();
      return {
        ok: true,
        action: "run_canary",
        deploymentId: req.body?.deploymentId ?? null,
        serviceName: req.body?.serviceName ?? null,
        requestedBy,
        queued_at: new Date().toISOString(),
      };
    },
  );

  // GET /api/operations/rollbacks/:id/inspect
  server.get<{ Params: { id: string } }>("/api/operations/rollbacks/:id/inspect", async (req, reply) => {
    const id = req.params.id;
    if (id.startsWith("deploy:")) {
      const deployId = id.slice("deploy:".length);
      const deploy = await queryOne<DeploymentRow>("SELECT * FROM deployments WHERE id = $1", [deployId]);
      if (!deploy) return reply.code(404).send({ error: "rollback_not_found" });
      return {
        inspect: {
          id,
          source: "deployments",
          deployment_id: deployId,
          status: deploy.status,
          detail: deploy.detail,
          created_at: deploy.created_at,
        },
      };
    }
    return reply.code(404).send({ error: "rollback_not_found" });
  });
}
