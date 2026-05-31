import type { FastifyInstance } from "fastify";
import { query, queryOne } from "../db.js";
import { withRateLimit } from "../lib/rate-limit.js";

export async function registerReportsPlansRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/reports-plans/reports", withRateLimit(async () => {
    const reports = await query<{
      id: string;
      release_id: string;
      environment: string;
      git_commit: string;
      status: string;
      detail: Record<string, unknown>;
      created_at: string;
    }>(`
      SELECT id::text AS id,
             release_id,
             environment,
             git_commit,
             status,
             detail,
             created_at::text AS created_at
      FROM deployments
      ORDER BY created_at DESC
      LIMIT 200
    `);

    return {
      reports,
      source_table: "deployments",
    };
  }));

  server.get<{ Params: { reportId: string } }>("/api/reports-plans/reports/:reportId", withRateLimit<{ Params: { reportId: string } }>(async (req, reply) => {
    const reportId = req.params.reportId.trim();
    if (!reportId) return reply.code(400).send({ error: "report_id_required" });

    const report = await queryOne<{
      id: string;
      release_id: string;
      environment: string;
      git_commit: string;
      status: string;
      detail: Record<string, unknown>;
      created_at: string;
    }>(`
      SELECT id::text AS id,
             release_id,
             environment,
             git_commit,
             status,
             detail,
             created_at::text AS created_at
      FROM deployments
      WHERE id::text = $1
      LIMIT 1
    `, [reportId]);
    if (!report) return reply.code(404).send({ error: "report_not_found" });

    return {
      report,
      evidence_refs: [
        typeof report.detail?.["evidence_ref"] === "string" ? String(report.detail["evidence_ref"]) : null,
        report.release_id,
      ].filter(Boolean),
      actions: ["export_report", "open_plan", "create_follow_up"],
    };
  }));

  server.get("/api/reports-plans/plans", withRateLimit(async () => {
    const plans = await query<{
      id: string;
      action_key: string;
      action_label: string;
      is_enabled: boolean;
      requires_policy: boolean;
      requires_evidence: boolean;
      updated_at: string;
    }>(`
      SELECT id::text AS id,
             action_key,
             action_label,
             is_enabled,
             requires_policy,
             requires_evidence,
             updated_at::text AS updated_at
      FROM room_actions
      WHERE room_key = 'reports_plans'
      ORDER BY updated_at DESC
      LIMIT 200
    `);

    return {
      plans,
      source_table: "room_actions",
    };
  }));

  server.get<{ Params: { planId: string } }>("/api/reports-plans/plans/:planId", withRateLimit<{ Params: { planId: string } }>(async (req, reply) => {
    const planId = req.params.planId.trim();
    if (!planId) return reply.code(400).send({ error: "plan_id_required" });

    const plan = await queryOne<{
      id: string;
      action_key: string;
      action_label: string;
      is_enabled: boolean;
      requires_policy: boolean;
      requires_evidence: boolean;
      updated_at: string;
    }>(`
      SELECT id::text AS id,
             action_key,
             action_label,
             is_enabled,
             requires_policy,
             requires_evidence,
             updated_at::text AS updated_at
      FROM room_actions
      WHERE room_key = 'reports_plans'
        AND id::text = $1
      LIMIT 1
    `, [planId]);
    if (!plan) return reply.code(404).send({ error: "plan_not_found" });

    return {
      plan,
      evidence_refs: [],
      actions: ["update_plan", "set_milestone", "create_follow_up"],
    };
  }));

  server.get("/api/reports-plans/milestones", withRateLimit(async () => {
    const milestones = await query<{
      id: string;
      title: string;
      category: string;
      status: string;
      starts_at: string;
      ends_at: string | null;
      owner: string | null;
      source: string;
      action_url: string | null;
      notes: string | null;
      created_at: string;
    }>(`
      SELECT id::text AS id,
             title,
             category,
             status,
             starts_at::text AS starts_at,
             ends_at::text AS ends_at,
             owner,
             source,
             action_url,
             notes,
             created_at::text AS created_at
      FROM calendar_events
      WHERE category IN ('executive', 'operations', 'policy', 'commercial', 'evidence')
      ORDER BY starts_at ASC
      LIMIT 300
    `);

    return {
      milestones,
      source_table: "calendar_events",
    };
  }));

  server.get<{ Params: { milestoneId: string } }>("/api/reports-plans/milestones/:milestoneId", withRateLimit<{ Params: { milestoneId: string } }>(async (req, reply) => {
    const milestoneId = req.params.milestoneId.trim();
    if (!milestoneId) return reply.code(400).send({ error: "milestone_id_required" });

    const milestone = await queryOne<{
      id: string;
      title: string;
      category: string;
      status: string;
      starts_at: string;
      ends_at: string | null;
      owner: string | null;
      source: string;
      action_url: string | null;
      notes: string | null;
      created_at: string;
    }>(`
      SELECT id::text AS id,
             title,
             category,
             status,
             starts_at::text AS starts_at,
             ends_at::text AS ends_at,
             owner,
             source,
             action_url,
             notes,
             created_at::text AS created_at
      FROM calendar_events
      WHERE id::text = $1
      LIMIT 1
    `, [milestoneId]);
    if (!milestone) return reply.code(404).send({ error: "milestone_not_found" });

    return {
      milestone,
      evidence_refs: [milestone.action_url].filter(Boolean),
      actions: ["inspect_milestone", "advance_milestone", "create_follow_up"],
    };
  }));

  server.get("/api/reports-plans/follow-ups", withRateLimit(async () => {
    const followUps = await query<{
      id: string;
      title: string;
      severity: string;
      status: string;
      summary: string;
      owner: string | null;
      opened_at: string;
      resolved_at: string | null;
    }>(`
      SELECT id::text AS id,
             title,
             severity,
             status,
             summary,
             owner,
             opened_at::text AS opened_at,
             resolved_at::text AS resolved_at
      FROM incidents
      ORDER BY opened_at DESC
      LIMIT 300
    `);

    return {
      follow_ups: followUps,
      source_table: "incidents",
    };
  }));

  server.get<{ Params: { followUpId: string } }>("/api/reports-plans/follow-ups/:followUpId", withRateLimit<{ Params: { followUpId: string } }>(async (req, reply) => {
    const followUpId = req.params.followUpId.trim();
    if (!followUpId) return reply.code(400).send({ error: "follow_up_id_required" });

    const followUp = await queryOne<{
      id: string;
      title: string;
      severity: string;
      status: string;
      summary: string;
      owner: string | null;
      opened_at: string;
      resolved_at: string | null;
    }>(`
      SELECT id::text AS id,
             title,
             severity,
             status,
             summary,
             owner,
             opened_at::text AS opened_at,
             resolved_at::text AS resolved_at
      FROM incidents
      WHERE id::text = $1
      LIMIT 1
    `, [followUpId]);
    if (!followUp) return reply.code(404).send({ error: "follow_up_not_found" });

    return {
      follow_up: followUp,
      evidence_refs: [],
      actions: ["resolve_follow_up", "assign_follow_up", "export_follow_up"],
    };
  }));
}
