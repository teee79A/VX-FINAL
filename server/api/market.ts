import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { query, queryOne } from "../db.js";

type JsonRecord = Record<string, unknown>;

function toMetadata(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return {};
}

function metaString(meta: JsonRecord, key: string): string | null {
  const value = meta[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function metaStringArray(meta: JsonRecord, key: string): string[] {
  const value = meta[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function deriveSourceNameFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.trim().toLowerCase();
    if (!hostname) return "target_market_registry";
    return `source_${hostname.replace(/[^a-z0-9]+/g, "_")}`;
  } catch {
    return "target_market_registry";
  }
}

export async function registerMarketRoutes(server: FastifyInstance): Promise<void> {
  server.get<{ Querystring: { limit?: string } }>("/api/market/targets", async (req) => {
    const rawLimit = Number.parseInt(req.query.limit ?? "100", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 100;

    const targets = await query<{
      symbol: string;
      display_name: string;
      source_name: string;
      metadata: JsonRecord;
      updated_at: string;
      intel_count: number;
      last_intel_utc: string | null;
      latest_headline: string | null;
      latest_url: string | null;
      source_status: string | null;
      source_base_url: string | null;
      source_last_sync_utc: string | null;
      source_last_error: string | null;
    }>(
      `SELECT t.symbol,
              t.display_name,
              t.source_name,
              t.metadata,
              t.updated_at::text AS updated_at,
              COALESCE(i.intel_count, 0)::int AS intel_count,
              i.last_intel_utc::text AS last_intel_utc,
              i.latest_headline,
              i.latest_url,
              s.status AS source_status,
              s.base_url AS source_base_url,
              s.last_sync_utc::text AS source_last_sync_utc,
              s.last_error AS source_last_error
         FROM market_targets t
         LEFT JOIN market_sources s
           ON s.source_name = t.source_name
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS intel_count,
                  MAX(captured_at) AS last_intel_utc,
                  (ARRAY_AGG(headline ORDER BY captured_at DESC))[1] AS latest_headline,
                  (ARRAY_AGG(url ORDER BY captured_at DESC))[1] AS latest_url
             FROM market_intel_rows r
            WHERE r.symbol = t.symbol
         ) i ON true
        WHERE t.is_active = true
          AND t.source_name <> 'coingecko'
        ORDER BY t.updated_at DESC, t.symbol ASC
        LIMIT $1`,
      [limit],
    );

    return {
      targets: targets.map((target) => {
        const metadata = toMetadata(target.metadata);
        return {
          symbol: target.symbol,
          display_name: target.display_name,
          source_name: target.source_name,
          sector: metaString(metadata, "sector"),
          region: metaString(metadata, "region"),
          priority: metaString(metadata, "priority"),
          status: metaString(metadata, "status"),
          summary: metaString(metadata, "summary"),
          notes: metaString(metadata, "notes"),
          sources: metaStringArray(metadata, "sources"),
          intel_count: target.intel_count,
          last_intel_utc: target.last_intel_utc,
          latest_headline: target.latest_headline,
          latest_url: target.latest_url,
          source_status: target.source_status,
          source_base_url: target.source_base_url,
          source_last_sync_utc: target.source_last_sync_utc,
          source_last_error: target.source_last_error,
          updated_at: target.updated_at,
        };
      }),
    };
  });

  server.get<{ Params: { symbol: string } }>("/api/market/targets/:symbol", async (req, reply) => {
    const symbol = req.params.symbol.trim().toUpperCase();
    if (!symbol) {
      return reply.code(400).send({ error: "symbol_required" });
    }

    const target = await queryOne<{
      symbol: string;
      display_name: string;
      source_name: string;
      metadata: JsonRecord;
      updated_at: string;
    }>(
      `SELECT symbol,
              display_name,
              source_name,
              metadata,
              updated_at::text AS updated_at
         FROM market_targets
        WHERE symbol = $1
          AND is_active = true
          AND source_name <> 'coingecko'
        LIMIT 1`,
      [symbol],
    );

    if (!target) {
      return reply.code(404).send({ error: "target_not_found" });
    }

    const metadata = toMetadata(target.metadata);
    const linkedSources = metaStringArray(metadata, "sources");
    const sourceNames = new Set<string>([target.source_name]);
    for (const sourceUrl of linkedSources) {
      sourceNames.add(deriveSourceNameFromUrl(sourceUrl));
    }

    const sources = await query<{
      source_name: string;
      status: string;
      base_url: string | null;
      last_sync_utc: string | null;
      last_error: string | null;
    }>(
      `SELECT source_name,
              status,
              base_url,
              last_sync_utc::text AS last_sync_utc,
              last_error
         FROM market_sources
        WHERE source_name = ANY($1::text[])
        ORDER BY source_name ASC`,
      [Array.from(sourceNames)],
    );

    const sourceByBaseUrl = new Map<string, {
      source_name: string;
      status: string;
      base_url: string | null;
      last_sync_utc: string | null;
      last_error: string | null;
    }>();
    for (const source of sources) {
      if (source.base_url) {
        sourceByBaseUrl.set(source.base_url, source);
      }
    }

    const sourceLinks = linkedSources.map((url) => ({
      url,
      source_name: sourceByBaseUrl.get(url)?.source_name ?? deriveSourceNameFromUrl(url),
      source_status: sourceByBaseUrl.get(url)?.status ?? null,
      source_last_sync_utc: sourceByBaseUrl.get(url)?.last_sync_utc ?? null,
      source_last_error: sourceByBaseUrl.get(url)?.last_error ?? null,
    }));

    const intelRows = await query<{
      id: string;
      source_name: string;
      headline: string;
      url: string | null;
      signal_type: string;
      sentiment: string;
      impact_score: number | null;
      captured_at: string;
      notes: string | null;
    }>(
      `SELECT id::text AS id,
              source_name,
              headline,
              url,
              signal_type,
              sentiment,
              impact_score,
              captured_at::text AS captured_at,
              notes
         FROM market_intel_rows
        WHERE symbol = $1
        ORDER BY captured_at DESC
        LIMIT 50`,
      [symbol],
    );

    return {
      target: {
        symbol: target.symbol,
        display_name: target.display_name,
        source_name: target.source_name,
        sector: metaString(metadata, "sector"),
        region: metaString(metadata, "region"),
        priority: metaString(metadata, "priority"),
        status: metaString(metadata, "status"),
        summary: metaString(metadata, "summary"),
        notes: metaString(metadata, "notes"),
        sources: sourceLinks,
        updated_at: target.updated_at,
      },
      source_details: sources,
      intelligence_rows: intelRows,
    };
  });

  server.get<{ Querystring: { limit?: string } }>("/api/market/intelligence", async (req) => {
    const rawLimit = Number.parseInt(req.query.limit ?? "200", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 200;

    const rows = await query<{
      id: string;
      symbol: string;
      source_name: string;
      headline: string;
      url: string | null;
      signal_type: string;
      sentiment: string;
      impact_score: number | null;
      captured_at: string;
      notes: string | null;
    }>(`
      SELECT id::text AS id,
             symbol,
             source_name,
             headline,
             url,
             signal_type,
             sentiment,
             impact_score,
             captured_at::text AS captured_at,
             notes
      FROM market_intel_rows
      ORDER BY captured_at DESC
      LIMIT $1
    `, [limit]);

    return { intelligence_rows: rows };
  });

  server.get("/api/market/sources", async () => {
    const sources = await query<{
      source_name: string;
      status: string;
      base_url: string | null;
      last_sync_utc: string | null;
      last_error: string | null;
      updated_at: string;
      target_count: number;
      intel_count: number;
    }>(`
      SELECT s.source_name,
             s.status,
             s.base_url,
             s.last_sync_utc::text AS last_sync_utc,
             s.last_error,
             s.updated_at::text AS updated_at,
             COALESCE(t.target_count, 0)::int AS target_count,
             COALESCE(i.intel_count, 0)::int AS intel_count
      FROM market_sources s
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS target_count
        FROM market_targets t
        WHERE t.source_name = s.source_name
          AND t.is_active = true
      ) t ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS intel_count
        FROM market_intel_rows r
        WHERE r.source_name = s.source_name
      ) i ON true
      WHERE s.source_name <> 'coingecko'
      ORDER BY s.updated_at DESC
    `);
    return { sources };
  });

  server.get<{ Params: { sourceName: string } }>("/api/market/sources/:sourceName", async (req, reply) => {
    const sourceName = req.params.sourceName.trim();
    if (!sourceName) return reply.code(400).send({ error: "source_name_required" });

    const source = await queryOne<{
      source_name: string;
      status: string;
      base_url: string | null;
      last_sync_utc: string | null;
      last_error: string | null;
      updated_at: string;
    }>(`
      SELECT source_name,
             status,
             base_url,
             last_sync_utc::text AS last_sync_utc,
             last_error,
             updated_at::text AS updated_at
      FROM market_sources
      WHERE source_name = $1
      LIMIT 1
    `, [sourceName]);
    if (!source) return reply.code(404).send({ error: "source_not_found" });

    const [targets, intelligence] = await Promise.all([
      query<{
        symbol: string;
        display_name: string;
        updated_at: string;
      }>(`
        SELECT symbol,
               display_name,
               updated_at::text AS updated_at
        FROM market_targets
        WHERE source_name = $1
          AND is_active = true
        ORDER BY updated_at DESC
        LIMIT 100
      `, [sourceName]),
      query<{
        id: string;
        symbol: string;
        headline: string;
        url: string | null;
        captured_at: string;
      }>(`
        SELECT id::text AS id,
               symbol,
               headline,
               url,
               captured_at::text AS captured_at
        FROM market_intel_rows
        WHERE source_name = $1
        ORDER BY captured_at DESC
        LIMIT 100
      `, [sourceName]),
    ]);

    return {
      source,
      targets,
      intelligence_rows: intelligence,
      actions: ["inspect_source", "refresh_target", "add_intel"],
    };
  });

  server.get<{ Params: { intelId: string } }>("/api/market/intelligence/:intelId", async (req, reply) => {
    const intelId = req.params.intelId.trim();
    if (!intelId) return reply.code(400).send({ error: "intel_id_required" });

    const intel = await queryOne<{
      id: string;
      symbol: string;
      source_name: string;
      headline: string;
      url: string | null;
      signal_type: string;
      sentiment: string;
      impact_score: number | null;
      captured_at: string;
      notes: string | null;
      raw: JsonRecord;
    }>(`
      SELECT id::text AS id,
             symbol,
             source_name,
             headline,
             url,
             signal_type,
             sentiment,
             impact_score,
             captured_at::text AS captured_at,
             notes,
             raw
      FROM market_intel_rows
      WHERE id::text = $1
      LIMIT 1
    `, [intelId]);
    if (!intel) return reply.code(404).send({ error: "intelligence_not_found" });

    return {
      intelligence: intel,
      evidence_refs: [intel.url].filter(Boolean),
      actions: ["refresh_target", "add_intel", "inspect_source"],
    };
  });

  server.get("/api/market/change-events", async () => {
    const events = await query<{
      id: string;
      event_type: string;
      event_payload: JsonRecord;
      evidence_ref: string | null;
      created_by: string;
      created_at: string;
    }>(`
      SELECT id::text AS id,
             event_type,
             event_payload,
             evidence_ref,
             created_by,
             created_at::text AS created_at
      FROM room_change_events
      WHERE room_key = 'market'
      ORDER BY created_at DESC
      LIMIT 200
    `);
    return { change_events: events };
  });

  server.get<{ Params: { eventId: string } }>("/api/market/change-events/:eventId", async (req, reply) => {
    const eventId = req.params.eventId.trim();
    if (!eventId) return reply.code(400).send({ error: "event_id_required" });

    const event = await queryOne<{
      id: string;
      event_type: string;
      event_payload: JsonRecord;
      evidence_ref: string | null;
      created_by: string;
      created_at: string;
    }>(`
      SELECT id::text AS id,
             event_type,
             event_payload,
             evidence_ref,
             created_by,
             created_at::text AS created_at
      FROM room_change_events
      WHERE room_key = 'market'
        AND id::text = $1
      LIMIT 1
    `, [eventId]);
    if (!event) return reply.code(404).send({ error: "change_event_not_found" });

    return {
      change_event: event,
      evidence_refs: [event.evidence_ref].filter(Boolean),
      actions: ["refresh_target", "inspect_source"],
    };
  });

  server.get<{ Params: { symbol: string } }>("/api/market/targets/:symbol/analyst-summary", async (req, reply) => {
    const symbol = req.params.symbol.trim().toUpperCase();
    if (!symbol) return reply.code(400).send({ error: "symbol_required" });

    const target = await queryOne<{
      symbol: string;
      display_name: string;
      metadata: JsonRecord;
    }>(`
      SELECT symbol, display_name, metadata
      FROM market_targets
      WHERE symbol = $1
        AND is_active = true
      LIMIT 1
    `, [symbol]);
    if (!target) return reply.code(404).send({ error: "target_not_found" });

    const stats = await queryOne<{
      intel_count: number;
      bullish_count: number;
      bearish_count: number;
      neutral_count: number;
      latest_captured_at: string | null;
    }>(`
      SELECT COUNT(*)::int AS intel_count,
             COUNT(*) FILTER (WHERE sentiment = 'bullish')::int AS bullish_count,
             COUNT(*) FILTER (WHERE sentiment = 'bearish')::int AS bearish_count,
             COUNT(*) FILTER (WHERE sentiment NOT IN ('bullish','bearish'))::int AS neutral_count,
             MAX(captured_at)::text AS latest_captured_at
      FROM market_intel_rows
      WHERE symbol = $1
    `, [symbol]);

    const metadata = toMetadata(target.metadata);

    return {
      target: {
        symbol: target.symbol,
        display_name: target.display_name,
        sector: metaString(metadata, "sector"),
        region: metaString(metadata, "region"),
        priority: metaString(metadata, "priority"),
        summary: metaString(metadata, "summary"),
      },
      analyst_summary: {
        intel_count: stats?.intel_count ?? 0,
        bullish_count: stats?.bullish_count ?? 0,
        bearish_count: stats?.bearish_count ?? 0,
        neutral_count: stats?.neutral_count ?? 0,
        latest_captured_at: stats?.latest_captured_at ?? null,
      },
      actions: ["refresh_target", "add_intel", "inspect_source"],
    };
  });

  server.post<{ Params: { symbol: string }; Body: { requestedBy?: string; evidenceRef?: string } }>(
    "/api/market/targets/:symbol/refresh",
    async (req, reply) => {
      const symbol = req.params.symbol.trim().toUpperCase();
      if (!symbol) return reply.code(400).send({ error: "symbol_required" });

      const target = await queryOne<{ symbol: string }>(
        `SELECT symbol FROM market_targets WHERE symbol = $1 AND is_active = true LIMIT 1`,
        [symbol],
      );
      if (!target) return reply.code(404).send({ error: "target_not_found" });

      const requestedBy = req.body?.requestedBy?.trim() || "operator";
      const evidenceRef = req.body?.evidenceRef?.trim() || `market:refresh:${symbol}:${new Date().toISOString()}`;

      await query(
        `INSERT INTO room_change_events (room_key, event_type, event_payload, evidence_ref, created_by)
         VALUES ('market', 'target_refresh_requested', $1, $2, $3)`,
        [JSON.stringify({ symbol }), evidenceRef, requestedBy],
      );

      return { ok: true, action: "refresh_target", symbol, evidence_ref: evidenceRef };
    },
  );

  server.post<{
    Body: {
      symbol: string;
      sourceName: string;
      headline: string;
      url?: string;
      signalType?: string;
      sentiment?: string;
      impactScore?: number;
      notes?: string;
      requestedBy?: string;
      evidenceRef?: string;
    };
  }>("/api/market/intelligence", async (req, reply) => {
    const symbol = req.body?.symbol?.trim().toUpperCase();
    const sourceName = req.body?.sourceName?.trim();
    const headline = req.body?.headline?.trim();
    if (!symbol || !sourceName || !headline) {
      return reply.code(400).send({ error: "symbol_sourceName_headline_required" });
    }

    const target = await queryOne<{ symbol: string }>(
      `SELECT symbol FROM market_targets WHERE symbol = $1 AND is_active = true LIMIT 1`,
      [symbol],
    );
    if (!target) return reply.code(404).send({ error: "target_not_found" });

    const inserted = await query<{
      id: string;
      captured_at: string;
    }>(`
      INSERT INTO market_intel_rows
        (symbol, source_name, headline, url, signal_type, sentiment, impact_score, captured_at, notes, raw)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9)
      RETURNING id::text AS id, captured_at::text AS captured_at
    `, [
      symbol,
      sourceName,
      headline,
      req.body?.url?.trim() || null,
      req.body?.signalType?.trim() || "manual_update",
      req.body?.sentiment?.trim() || "neutral",
      Number.isFinite(req.body?.impactScore) ? req.body?.impactScore : null,
      req.body?.notes?.trim() || null,
      JSON.stringify({
        source: "manual",
        requestedBy: req.body?.requestedBy?.trim() || "operator",
        evidenceRef: req.body?.evidenceRef?.trim() || null,
      }),
    ]);

    const changeEvidenceRef = req.body?.evidenceRef?.trim() || `market:intel:${symbol}:${randomUUID()}`;
    await query(
      `INSERT INTO room_change_events (room_key, event_type, event_payload, evidence_ref, created_by)
       VALUES ('market', 'intel_added', $1, $2, $3)`,
      [
        JSON.stringify({ symbol, intel_id: inserted[0]?.id ?? null, source_name: sourceName }),
        changeEvidenceRef,
        req.body?.requestedBy?.trim() || "operator",
      ],
    );

    return {
      ok: true,
      action: "add_intel",
      intelligence_id: inserted[0]?.id ?? null,
      captured_at: inserted[0]?.captured_at ?? null,
      evidence_ref: changeEvidenceRef,
    };
  });
}
