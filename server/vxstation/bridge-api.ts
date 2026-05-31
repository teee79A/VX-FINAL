/**
 * VXSTATION Bridge API — Internal endpoints for VXSTATION droplet
 * Pulled over Tailscale private network from VYRDX droplet
 */

import type { FastifyInstance } from "fastify";
import { getTelemetryEventsForRoom } from "../vyrdx/api/telemetry.js";
import { getLaunchEventsForRoom } from "../vyrdx/domain/launch-events.js";

type HealthStatus = {
  ok: boolean;
  status: string;
  mode: string;
  uptime_seconds: number;
  uptime_human: string;
  timestamp: string;
  bridge: {
    vyrdx_connected: boolean;
    telemetry_available: boolean;
    bot_available: boolean;
  };
};

type MarketSummary = {
  window: string;
  pageViews: number;
  gateEvaluations: number;
  gateGreen: number;
  gateYellow: number;
  gateRed: number;
  topPaths: Array<{ path: string; count: number }>;
  topMissingFields: string[];
  timestamp: string;
};

type GateStreamEvent = {
  id: string;
  type: string;
  sessionId?: string;
  status?: string;
  eligible?: boolean;
  missingFields?: string[];
  timestamp: string;
};

type BotJobSummary = {
  id: string;
  status: string;
  targetCount: number;
  sentCount: number;
  replyCount: number;
  bookedCount: number;
  createdAt: string;
  completedAt?: string;
};

// In-memory state for VXSTATION bridge
let bridgeState = {
  vyrdxConnected: true,
  lastHealthCheck: Date.now(),
  errorCount: 0,
};

export async function registerVxstationBridgeRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/vxstation/health — Bridge health check
  server.get("/api/vxstation/health", async (_request, reply) => {
    const uptime = process.uptime();
    const health: HealthStatus = {
      ok: bridgeState.vyrdxConnected && bridgeState.errorCount < 10,
      status: bridgeState.errorCount >= 10 ? "degraded" : "ok",
      mode: "bridge",
      uptime_seconds: Math.floor(uptime),
      uptime_human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      timestamp: new Date().toISOString(),
      bridge: {
        vyrdx_connected: bridgeState.vyrdxConnected,
        telemetry_available: true,
        bot_available: true,
      },
    };
    return reply.code(health.ok ? 200 : 503).send(health);
  });

  // GET /api/vxstation/market/summary — Market telemetry summary
  server.get("/api/vxstation/market/summary", async (request, reply) => {
    try {
      const window = (request.query as { window?: string }).window ?? "15m";
      const events = getTelemetryEventsForRoom();

      const windowMs = parseWindow(window);
      const cutoff = Date.now() - windowMs;
      const windowed = events.filter((e) => new Date(e.timestamp).getTime() >= cutoff);

      const byPath: Record<string, number> = {};
      let pageViews = 0;
      let gateEvaluations = 0;
      let gateGreen = 0;
      let gateYellow = 0;
      let gateRed = 0;
      const missingFieldsCount: Record<string, number> = {};

      for (const event of windowed) {
        if (event.path) {
          byPath[event.path] = (byPath[event.path] ?? 0) + 1;
        }
        if (event.type === "page_view") pageViews++;
        if (event.type === "gate_result") {
          gateEvaluations++;
          const status = event.decisionStatus?.toLowerCase() ?? "";
          if (status.includes("eligible") || status.includes("certified")) gateGreen++;
          else if (status.includes("review") || status.includes("incomplete")) gateYellow++;
          else gateRed++;
          if (event.missingFields) {
            for (const f of event.missingFields) {
              missingFieldsCount[f] = (missingFieldsCount[f] ?? 0) + 1;
            }
          }
        }
      }

      const topPaths = Object.entries(byPath)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([path, count]) => ({ path, count }));

      const topMissingFields = Object.entries(missingFieldsCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([f]) => f);

      const summary: MarketSummary = {
        window,
        pageViews,
        gateEvaluations,
        gateGreen,
        gateYellow,
        gateRed,
        topPaths,
        topMissingFields,
        timestamp: new Date().toISOString(),
      };

      bridgeState.vyrdxConnected = true;
      bridgeState.errorCount = 0;
      return reply.send(summary);
    } catch (error) {
      bridgeState.errorCount++;
      return reply.code(500).send({
        error: "DATA_UNAVAILABLE",
        reason: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /api/vxstation/gate/stream — Gate event stream for SSE/WebSocket
  server.get("/api/vxstation/gate/stream", async (request, reply) => {
    try {
      const limit = Math.min(Number((request.query as { limit?: string }).limit) || 100, 500);
      const events = getTelemetryEventsForRoom()
        .filter((e) => e.type === "gate_result" || e.type === "gate_eval_requested")
        .slice(-limit);

      const streamEvents: GateStreamEvent[] = events.map((e) => ({
        id: e.id,
        type: e.type,
        sessionId: e.sessionId,
        status: e.decisionStatus,
        eligible: e.eligibleToProceed,
        missingFields: e.missingFields,
        timestamp: e.timestamp,
      }));

      return reply.send({ events: streamEvents, total: streamEvents.length });
    } catch (error) {
      return reply.code(500).send({
        error: "DATA_UNAVAILABLE",
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // GET /api/vxstation/bot/jobs — Bot job summary list
  server.get("/api/vxstation/bot/jobs", async (request, reply) => {
    try {
      // Import from bot-flyers module
      const { getBotJobsForRoom } = await import("../vyrdx/api/bot-flyers.js");
      const limit = Math.min(Number((request.query as { limit?: string }).limit) || 50, 200);
      const jobs = getBotJobsForRoom().slice(0, limit);

      const summaries: BotJobSummary[] = jobs.map((job) => ({
        id: job.id,
        status: job.status,
        targetCount: job.targets.length,
        sentCount: job.flyerSentCount,
        replyCount: job.replyReceivedCount,
        bookedCount: job.bookedCount,
        createdAt: job.createdAt,
        completedAt: job.runFinishedAt,
      }));

      return reply.send({ jobs: summaries, total: summaries.length });
    } catch (error) {
      return reply.code(500).send({
        error: "DATA_UNAVAILABLE",
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // GET /api/vxstation/launch/events — Launch events from feedback room
  server.get("/api/vxstation/launch/events", async (request, reply) => {
    try {
      const limit = Math.min(Number((request.query as { limit?: string }).limit) || 100, 500);
      const events = getLaunchEventsForRoom().slice(-limit);
      return reply.send({ events, total: events.length, timestamp: new Date().toISOString() });
    } catch (error) {
      return reply.code(500).send({
        error: "DATA_UNAVAILABLE",
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([mh])$/);
  if (!match) return 15 * 60 * 1000;
  const value = Number.parseInt(match[1], 10);
  return match[2] === "h" ? value * 60 * 60 * 1000 : value * 60 * 1000;
}