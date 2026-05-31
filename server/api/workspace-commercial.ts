/**
 * VYRDx Commercial Room API v2
 *
 * GET /api/v1/workspaces/:workspaceId/rooms/commercial — workspace-scoped
 * GET /api/v1/rooms/commercial — global aggregate
 *
 * Rich JSON: summary, statusReasons, changeEvents, actions, calendar
 * Must answer: "What money problem needs action now?"
 *
 * VYRDON Law §1: No fabricated data. Empty tables → honest zeros.
 */

import type { FastifyInstance } from "fastify";
import { query, queryOne } from "../db.js";

const PLAN_PRICE_CENTS: Record<string, number> = {
  free: 0,
  solo: 4900,
  business: 14900,
  enterprise: 49900,
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function deriveStatusColor(failedPayments: number, unpaidCents: number): "green" | "yellow" | "red" {
  if (failedPayments > 0 && unpaidCents > 0) return "red";
  if (failedPayments > 0 || unpaidCents > 0) return "yellow";
  return "green";
}

function deriveReasonCode(failedPayments: number, unpaidCents: number): string {
  if (failedPayments > 0 && unpaidCents > 0) return "failed_payments_and_overdue";
  if (failedPayments > 0) return "failed_payments_present";
  if (unpaidCents > 0) return "overdue_invoices";
  return "all_clear";
}

function deriveReasonText(failedPayments: number, unpaidCents: number): string {
  const parts: string[] = [];
  if (failedPayments > 0) parts.push(`${failedPayments} failed payment${failedPayments > 1 ? "s" : ""}`);
  if (unpaidCents > 0) parts.push(`${formatCents(unpaidCents)} overdue`);
  if (parts.length === 0) return "All clear — no money problems";
  return `${parts.join(" and ")} require${parts.length === 1 && failedPayments <= 1 ? "s" : ""} action.`;
}

async function buildCommercialData(workspaceFilter: string | null) {
  const wsCondition = workspaceFilter ? "WHERE workspace_id = $1" : "";
  const wsJoinCondition = workspaceFilter ? "AND workspace_id = $1" : "";
  const wsParams = workspaceFilter ? [workspaceFilter] : [];

  // MRR from workspace plans
  const mrrRow = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(CASE
       WHEN plan = 'solo' THEN 4900
       WHEN plan = 'business' THEN 14900
       WHEN plan = 'enterprise' THEN 49900
       ELSE 0 END), 0)::text AS total
     FROM workspaces ${workspaceFilter ? "WHERE id = $1" : ""}`,
    wsParams,
  );
  const mrrCents = parseInt(mrrRow?.total ?? "0", 10);

  // Active customers (non-free workspaces)
  const activeRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM workspaces WHERE plan != 'free' ${workspaceFilter ? "AND id = $1" : ""}`,
    wsParams,
  );
  const activeCustomers = parseInt(activeRow?.count ?? "0", 10);

  // Failed payments (7 days)
  const failedRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM billing_events
     WHERE event_type = 'invoice_failed' AND created_at > now() - interval '7 days' ${wsJoinCondition}`,
    wsParams,
  );
  const failedPayments7d = parseInt(failedRow?.count ?? "0", 10);

  // Unpaid balance (30 days)
  const unpaidRow = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(amount_cents), 0)::text AS total FROM billing_events
     WHERE event_type IN ('invoice_overdue', 'invoice_failed') AND created_at > now() - interval '30 days' ${wsJoinCondition}`,
    wsParams,
  );
  const unpaidBalanceCents = parseInt(unpaidRow?.total ?? "0", 10);

  // Renewals due (30 days from calendar)
  const renewalRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM calendar_events
     WHERE category = 'commercial' AND status IN ('scheduled', 'due')
     AND starts_at BETWEEN now() AND now() + interval '30 days'`,
  );
  const renewalsDue30d = parseInt(renewalRow?.count ?? "0", 10);

  // New customers (30 days)
  const newCustRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM billing_events
     WHERE event_type = 'subscription_started' AND created_at > now() - interval '30 days' ${wsJoinCondition}`,
    wsParams,
  );
  const newCustomers30d = parseInt(newCustRow?.count ?? "0", 10);

  // Churned customers (30 days)
  const churnRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM billing_events
     WHERE event_type = 'subscription_canceled' AND created_at > now() - interval '30 days' ${wsJoinCondition}`,
    wsParams,
  );
  const churnedCustomers30d = parseInt(churnRow?.count ?? "0", 10);

  // Status reasons from billing events (recent failures/overdues)
  const reasonRows = await query<{
    id: string; event_type: string; customer_name: string;
    amount_cents: string; related_ref: string; created_at: string;
  }>(
    `SELECT id, event_type, COALESCE(customer_name, 'Unknown') AS customer_name,
            COALESCE(amount_cents, 0)::text AS amount_cents,
            COALESCE((event_data->>'invoiceId')::text, id) AS related_ref,
            created_at::text AS created_at
     FROM billing_events
     WHERE event_type IN ('invoice_failed', 'invoice_overdue')
     AND created_at > now() - interval '30 days' ${wsJoinCondition}
     ORDER BY created_at DESC LIMIT 10`,
    wsParams,
  );

  const statusReasons = reasonRows.map((r) => ({
    id: `csr_${r.id.slice(0, 8)}`,
    severity: r.event_type === "invoice_failed" ? "warning" as const : "warning" as const,
    reasonCode: r.event_type === "invoice_failed" ? "failed_payment" : "invoice_overdue",
    reasonText: r.event_type === "invoice_failed"
      ? `Payment failed for ${r.customer_name} (${formatCents(parseInt(r.amount_cents, 10))}).`
      : `Invoice for ${r.customer_name} is overdue (${formatCents(parseInt(r.amount_cents, 10))}).`,
    sourceSystem: "billing",
    evidenceRef: r.related_ref,
    detectedAtUtc: r.created_at,
  }));

  // Change events (recent billing events)
  const eventRows = await query<{
    id: string; event_type: string; customer_name: string;
    amount_cents: string; event_data: string; created_at: string;
  }>(
    `SELECT id, event_type, COALESCE(customer_name, 'Unknown') AS customer_name,
            COALESCE(amount_cents, 0)::text AS amount_cents,
            event_data::text AS event_data, created_at::text AS created_at
     FROM billing_events ${wsCondition}
     ORDER BY created_at DESC LIMIT 10`,
    wsParams,
  );

  const EVENT_TITLES: Record<string, string> = {
    subscription_started: "New customer activated",
    subscription_upgraded: "Subscription upgraded",
    subscription_downgraded: "Subscription downgraded",
    invoice_issued: "Invoice issued",
    invoice_paid: "Invoice paid",
    invoice_failed: "Invoice payment failed",
    invoice_overdue: "Invoice overdue",
    subscription_canceled: "Subscription canceled",
  };

  const changeEvents = eventRows.map((r) => ({
    id: `cce_${r.id.slice(0, 8)}`,
    eventType: r.event_type,
    title: EVENT_TITLES[r.event_type] ?? r.event_type,
    description: `${r.customer_name} — ${formatCents(parseInt(r.amount_cents, 10))}`,
    actor: "system",
    sourceSystem: "billing",
    evidenceRef: r.id,
    createdAtUtc: r.created_at,
  }));

  // Actions from commercial_actions
  const actionRows = await query<{
    id: string; action_type: string; title: string; description: string;
    related_customer: string; priority: string; status: string;
    due_at: string; created_at: string;
  }>(
    `SELECT id, action_type, title, description,
            COALESCE(related_customer, '') AS related_customer,
            priority, status,
            COALESCE(due_at::text, '') AS due_at,
            created_at::text AS created_at
     FROM commercial_actions
     WHERE status IN ('open', 'in_progress') ${wsJoinCondition}
     ORDER BY
       CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       created_at ASC
     LIMIT 20`,
    wsParams,
  );

  const actions = actionRows.map((r) => ({
    id: r.id,
    actionType: r.action_type,
    title: r.title,
    description: r.description,
    assignee: null as string | null,
    dueAtUtc: r.due_at || null,
    priority: r.priority as "low" | "medium" | "high" | "critical",
    status: r.status as "open" | "in_progress" | "blocked" | "done",
    evidenceRef: null as string | null,
  }));

  // Calendar items
  const calendarRows = await query<{
    id: string; title: string; category: string;
    starts_at: string; owner: string; status: string;
  }>(
    `SELECT id, title, category, starts_at::text AS starts_at,
            COALESCE(owner, '') AS owner, status
     FROM calendar_events
     WHERE category = 'commercial' AND starts_at > now()
     ORDER BY starts_at ASC LIMIT 10`,
  );

  const calendar = calendarRows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    startsAtUtc: r.starts_at,
    owner: r.owner || null,
    status: r.status,
    evidenceRef: null as string | null,
  }));

  const statusColor = deriveStatusColor(failedPayments7d, unpaidBalanceCents);
  const reasonCode = deriveReasonCode(failedPayments7d, unpaidBalanceCents);
  const reasonText = deriveReasonText(failedPayments7d, unpaidBalanceCents);
  const nextAction = actions.length > 0 ? actions[0]!.title : null;

  return {
    summary: {
      roomKey: "commercial",
      roomTitle: "Commercial",
      statusColor,
      reasonCode,
      reasonText,
      deltaSummary: null as string | null,
      updatedAtUtc: new Date().toISOString(),
      owner: null as string | null,
      evidenceRef: null as string | null,
      nextAction,
      nextUpdateEta: null as string | null,
      mrrCents,
      arrCents: mrrCents * 12,
      activeCustomers,
      unpaidBalanceCents,
      failedPayments7d,
      renewalsDue30d,
      newCustomers30d,
      churnedCustomers30d,
    },
    statusReasons,
    changeEvents,
    actions,
    calendar,
  };
}

export async function registerWorkspaceCommercialRoutes(server: FastifyInstance): Promise<void> {

  // Workspace-scoped
  server.get<{ Params: { workspaceId: string } }>(
    "/api/v1/workspaces/:workspaceId/rooms/commercial",
    async (request, reply) => {
      const { workspaceId } = request.params;
      const ws = await queryOne<{ id: string }>(
        "SELECT id FROM workspaces WHERE id = $1 OR slug = $1",
        [workspaceId],
      );
      if (!ws) return reply.status(404).send({ error: "Workspace not found" });
      return buildCommercialData(ws.id);
    },
  );

  // Global aggregate
  server.get("/api/v1/rooms/commercial", async () => {
    return buildCommercialData(null);
  });
}
