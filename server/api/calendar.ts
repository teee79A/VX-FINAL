/**
 * Calendar — API Surface
 *
 * Business calendar for VYRDx: invoice due dates, deploy windows, renewals,
 * evidence verification cycles, governance checkpoints, executive reviews.
 *
 * GET  /api/calendar/summary     — today, this week, overdue, upcoming counts
 * GET  /api/calendar/events      — list events with filters (?category, ?status, ?from, ?to)
 * GET  /api/calendar/today       — events for today
 * GET  /api/calendar/week        — events for this week
 * GET  /api/calendar/overdue     — overdue items
 * POST /api/calendar/events      — create event
 * POST /api/calendar/events/:id/complete — mark complete
 * POST /api/calendar/events/:id/block   — mark blocked
 * POST /api/calendar/sync        — auto-generate events from invoices, contracts, deployments
 */

import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { query, queryOne } from "../db.js";

interface CalendarRow {
  id: string;
  title: string;
  category: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  owner: string | null;
  source: string;
  related_entity_id: string | null;
  action_url: string | null;
  notes: string | null;
  created_at: string;
}

export async function registerCalendarRoutes(app: FastifyInstance): Promise<void> {

  // ── SUMMARY ─────────────────────────────────────────────────────────────
  app.get("/api/calendar/summary", async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();

    const [todayRows, weekRows, overdueRows, upcomingRows, byCategory] = await Promise.all([
      query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM calendar_events WHERE starts_at >= $1 AND starts_at < $2 AND status != 'completed'",
        [todayStart, todayEnd],
      ),
      query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM calendar_events WHERE starts_at >= $1 AND starts_at < $2 AND status != 'completed'",
        [todayStart, weekEnd],
      ),
      query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM calendar_events WHERE status = 'overdue'",
      ),
      query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM calendar_events WHERE starts_at > $1 AND starts_at < $2 AND status IN ('scheduled','due')",
        [todayEnd, weekEnd],
      ),
      query<{ category: string; count: string }>(
        "SELECT category, COUNT(*)::text AS count FROM calendar_events WHERE status != 'completed' GROUP BY category",
      ),
    ]);

    const categories: Record<string, number> = {};
    for (const r of byCategory) {
      categories[r.category] = parseInt(r.count, 10);
    }

    return {
      today: parseInt(todayRows[0]?.count ?? "0", 10),
      thisWeek: parseInt(weekRows[0]?.count ?? "0", 10),
      overdue: parseInt(overdueRows[0]?.count ?? "0", 10),
      upcoming: parseInt(upcomingRows[0]?.count ?? "0", 10),
      byCategory: categories,
    };
  });

  // ── LIST EVENTS ─────────────────────────────────────────────────────────
  app.get("/api/calendar/events", async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (q.category) {
      conditions.push(`category = $${idx++}`);
      params.push(q.category);
    }
    if (q.status) {
      conditions.push(`status = $${idx++}`);
      params.push(q.status);
    }
    if (q.from) {
      conditions.push(`starts_at >= $${idx++}`);
      params.push(q.from);
    }
    if (q.to) {
      conditions.push(`starts_at < $${idx++}`);
      params.push(q.to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(parseInt(q.limit ?? "100", 10), 500);

    const events = await query<CalendarRow>(
      `SELECT * FROM calendar_events ${where} ORDER BY starts_at ASC LIMIT ${limit}`,
      params,
    );
    return { events, total: events.length };
  });

  // ── TODAY ────────────────────────────────────────────────────────────────
  app.get("/api/calendar/today", async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const events = await query<CalendarRow>(
      "SELECT * FROM calendar_events WHERE starts_at >= $1 AND starts_at < $2 ORDER BY starts_at ASC",
      [todayStart, todayEnd],
    );
    return { date: todayStart.slice(0, 10), events };
  });

  // ── THIS WEEK ───────────────────────────────────────────────────────────
  app.get("/api/calendar/week", async () => {
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);

    const events = await query<CalendarRow>(
      "SELECT * FROM calendar_events WHERE starts_at >= $1 AND starts_at < $2 ORDER BY starts_at ASC",
      [monday.toISOString(), sunday.toISOString()],
    );

    const days: Record<string, CalendarRow[]> = {};
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const key = `${dayNames[i]} ${d.getMonth() + 1}/${d.getDate()}`;
      days[key] = [];
    }
    for (const ev of events) {
      const d = new Date(ev.starts_at);
      const dayIdx = (d.getDay() + 6) % 7;
      const dayKey = Object.keys(days)[dayIdx];
      const bucket = dayKey ? days[dayKey] : undefined;
      if (bucket) {
        bucket.push(ev);
      }
    }
    return { weekOf: monday.toISOString().slice(0, 10), days };
  });

  // ── OVERDUE ─────────────────────────────────────────────────────────────
  app.get("/api/calendar/overdue", async () => {
    const events = await query<CalendarRow>(
      "SELECT * FROM calendar_events WHERE status = 'overdue' ORDER BY starts_at ASC",
    );
    return { events, total: events.length };
  });

  // ── CREATE EVENT ────────────────────────────────────────────────────────
  app.post("/api/calendar/events", async (req) => {
    const body = req.body as Record<string, unknown>;
    const id = randomUUID();
    const title = String(body.title ?? "");
    const category = String(body.category ?? "operations");
    const status = String(body.status ?? "scheduled");
    const startsAt = String(body.startsAt ?? new Date().toISOString());
    const endsAt = body.endsAt ? String(body.endsAt) : null;
    const owner = body.owner ? String(body.owner) : null;
    const source = String(body.source ?? "manual");
    const relatedEntityId = body.relatedEntityId ? String(body.relatedEntityId) : null;
    const actionUrl = body.actionUrl ? String(body.actionUrl) : null;
    const notes = body.notes ? String(body.notes) : null;

    if (!title) return { error: "title required" };

    await query(
      `INSERT INTO calendar_events (id, title, category, status, starts_at, ends_at, owner, source, related_entity_id, action_url, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, title, category, status, startsAt, endsAt, owner, source, relatedEntityId, actionUrl, notes],
    );
    return { id, created: true };
  });

  // ── COMPLETE ────────────────────────────────────────────────────────────
  app.post("/api/calendar/events/:id/complete", async (req) => {
    const { id } = req.params as { id: string };
    await query("UPDATE calendar_events SET status = 'completed' WHERE id = $1", [id]);
    return { id, status: "completed" };
  });

  // ── BLOCK ───────────────────────────────────────────────────────────────
  app.post("/api/calendar/events/:id/block", async (req) => {
    const { id } = req.params as { id: string };
    await query("UPDATE calendar_events SET status = 'blocked' WHERE id = $1", [id]);
    return { id, status: "blocked" };
  });

  // ── SYNC — auto-generate events from business data ──────────────────────
  app.post("/api/calendar/sync", async () => {
    let synced = 0;

    // Invoice due dates → calendar
    const invoices = await query<{ id: string; period_end: string; total_cents: string; status: string; company_name: string }>(
      `SELECT i.id, i.period_end, i.total_cents, i.status, c.company_name
       FROM invoices i JOIN customers c ON i.customer_id = c.id
       WHERE i.status IN ('issued','overdue')`,
    );
    for (const inv of invoices) {
      const exists = await queryOne("SELECT id FROM calendar_events WHERE related_entity_id = $1 AND category = 'commercial'", [inv.id]);
      if (!exists) {
        const dueDate = new Date(inv.period_end);
        const calStatus = dueDate < new Date() ? "overdue" : "due";
        await query(
          `INSERT INTO calendar_events (title, category, status, starts_at, source, related_entity_id, action_url, notes)
           VALUES ($1, 'commercial', $2, $3, 'stripe', $4, '/rooms/revenue', $5)`,
          [`Invoice due: ${inv.company_name} — $${(parseInt(inv.total_cents, 10) / 100).toFixed(2)}`, calStatus, dueDate.toISOString(), inv.id, `Status: ${inv.status}`],
        );
        synced++;
      }
    }

    // Contract renewals → calendar
    const contracts = await query<{ id: string; renews_at: string; company_name: string }>(
      `SELECT ct.id, ct.renews_at, c.company_name
       FROM contracts ct JOIN customers c ON ct.customer_id = c.id
       WHERE ct.renews_at IS NOT NULL AND ct.status = 'active'`,
    );
    for (const ct of contracts) {
      const exists = await queryOne("SELECT id FROM calendar_events WHERE related_entity_id = $1 AND category = 'commercial'", [ct.id]);
      if (!exists) {
        await query(
          `INSERT INTO calendar_events (title, category, status, starts_at, source, related_entity_id, action_url, notes)
           VALUES ($1, 'commercial', 'scheduled', $2, 'system', $3, '/rooms/revenue', 'Contract renewal')`,
          [`Renewal: ${ct.company_name}`, ct.renews_at, ct.id],
        );
        synced++;
      }
    }

    // Mark past-due events as overdue
    const marked = await query<{ count: string }>(
      `UPDATE calendar_events SET status = 'overdue' WHERE status IN ('scheduled','due') AND starts_at < now() RETURNING id`,
    );

    return { synced, markedOverdue: marked.length };
  });
}
