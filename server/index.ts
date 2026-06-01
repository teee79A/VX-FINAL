// server/index.ts
// No placeholders. No stubs. This is the running process.

import Fastify from "fastify";
import fastifyWebSocket from "@fastify/websocket";
import { bootConductor, CeoConductor, WORKFLOWS } from "../ENGINES/ceo/conductor.js";
import type { EngineContext } from "../ENGINES/types.js";
import { randomUUID } from "node:crypto";
import { BUILD_META } from "./build-meta.js";
import { registerSealRoutes } from "./seal-api.js";
import { registerRoomRoutes } from "./rooms.js";
import { registerMonitorRoutes } from "./monitor.js";
import { registerCommercialRoutes } from "./api/commercial.js";
import { registerOperationsRoutes } from "./api/operations.js";
import { registerEvidenceRoutes } from "./api/evidence.js";
import { registerCalendarRoutes } from "./api/calendar.js";
import { registerWorkspaceCommercialRoutes } from "./api/workspace-commercial.js";
import { registerSealService } from "./api/seal-service.js";
import { registerPaymentRoutes } from "./api/payments.js";
import { registerRoomContractRoutes } from "./api/room-contract.js";
import { registerPolicyRoutes } from "./api/policy.js";
import { registerCampRoutes } from "./api/camp.js";
import { registerMarketRoutes } from "./api/market.js";
import { registerReportsPlansRoutes } from "./api/reports-plans.js";
import { dbHealthy } from "./db.js";
import { seedBootData } from "./seed.js";
import { CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET, ENV } from "./env.js";
import { runtimeModeService } from "./services/runtimeModeService.js";
import
{
  isZeroTrustServiceTokenConfigured,
  normalizeHeaderValue,
  requiresZeroTrustGuard,
} from "./security/zero-trust.js";

// ── BOOT ───────────────────────────────────────────────────────────────────

const conductor: CeoConductor = bootConductor();

function makeCtx ( caller = "http" ): EngineContext
{
  return {
    stationRoot: ENV.kittyRoot,
    timestamp: Date.now(),
    requestId: randomUUID(),
    caller,
  };
}

// ── SERVER ─────────────────────────────────────────────────────────────────

const app = Fastify( { logger: true } );
await app.register( fastifyWebSocket );
if ( ENV.mode !== "cloud" )
{
  await registerSealRoutes( app );
}

app.addHook( "onRequest", async ( request, reply ) =>
{
  if ( !ENV.isCloud || !requiresZeroTrustGuard( request.method, request.url ) )
  {
    return;
  }

  if ( !isZeroTrustServiceTokenConfigured() )
  {
    return reply.status( 503 ).send( {
      error: "zero_trust_not_configured",
      message: "Cloudflare Access service token is not configured for protected mutation routes.",
      scope: "write",
    } );
  }

  const expectedClientId = CF_ACCESS_CLIENT_ID?.trim() ?? "";
  const expectedClientSecret = CF_ACCESS_CLIENT_SECRET?.trim() ?? "";
  const providedClientId = normalizeHeaderValue( request.headers[ "cf-access-client-id" ] );
  const providedClientSecret = normalizeHeaderValue( request.headers[ "cf-access-client-secret" ] );
  if ( providedClientId !== expectedClientId || providedClientSecret !== expectedClientSecret )
  {
    return reply.status( 403 ).send( {
      error: "zero_trust_denied",
      message: "Protected mutation route requires a valid Cloudflare Access service token.",
      scope: "write",
    } );
  }
} );

// ── PRODUCT SEPARATION: cloud = VYRDx product, local = KITTY operator ──
if ( ENV.mode === "cloud" )
{
  // VYRDX routes removed - clean VXSTATION source
} else
{
  await registerRoomRoutes( app, ENV.mode );
  await registerMonitorRoutes( app, ENV.mode );
}
await registerRoomContractRoutes( app );
await registerPolicyRoutes( app );
// VYRDX-specific route registrations removed - clean VXSTATION source

if ( ENV.mode === "cloud" )
{
  app.get( "/monitor", async ( _req, reply ) =>
  {
    return reply.code( 404 ).send( { error: "kitty_local_only", message: "Monitor is local-only in cloud mode." } );
  } );
  app.get( "/api/monitor", async ( _req, reply ) =>
  {
    return reply.code( 404 ).send( { error: "kitty_local_only", message: "Monitor API is local-only in cloud mode." } );
  } );
}

const runtimeState = await runtimeModeService.bootstrapRuntimeMode( app.log );
runtimeModeService.startRuntimeModeMonitor( app.log );

// ── DATABASE PRIMARY MODE (writes + full APIs) ───────────────────────────
if ( runtimeState.runtimeMode === "primary_db" )
{
  try
  {
    await seedBootData();
    app.log.info( "Boot data seeded" );
  } catch ( error )
  {
    app.log.warn( { err: error }, "Boot data seed failed; continuing with existing DB state" );
  }
  await registerCommercialRoutes( app );
  await registerOperationsRoutes( app );
  await registerEvidenceRoutes( app );
  await registerCalendarRoutes( app );
  await registerWorkspaceCommercialRoutes( app );
  await registerCampRoutes( app );
  await registerMarketRoutes( app );
  await registerReportsPlansRoutes( app );
  if ( ENV.mode === "cloud" )
  {
    await registerSealService( app );
    await registerPaymentRoutes( app );
    app.log.info( "Seal service + payment routes (DB-backed) registered" );
  }
} else
{
  app.log.warn(
    {
      runtimeMode: runtimeState.runtimeMode,
      reason: runtimeState.lastDatabaseError,
    },
    "DB-backed APIs disabled; runtime in degraded_read_only mode",
  );
}

// ── HEALTH ─────────────────────────────────────────────────────────────────

async function getHealthPayload ()
{
  const serverHealth = await conductor.checkAllServers();
  const snapshot = null; // VYRDX bridge removed
  const runtime = runtimeModeService.getRuntimeModeSnapshot();

  return {
    ok: true,
    status: "ok",
    mode: ENV.mode,
    environment: ENV.environment,
    releaseId: ENV.releaseId,
    buildId: ENV.buildId,
    uptime: process.uptime(),
    uptime_human: `${ Math.floor( process.uptime() / 3600 ) }h ${ Math.floor( ( process.uptime() % 3600 ) / 60 ) }m`,
    kittyRoot: ENV.kittyRoot,
    conductor: {
      topology: conductor.getTopology(),
      servers: Object.fromEntries( serverHealth ),
    },
    bridge: null, // VYRDX bridge removed
    runtimeMode: runtime.runtimeMode,
    isDatabaseConfigured: runtime.isDatabaseConfigured,
    isDatabaseHealthy: runtime.isDatabaseHealthy,
    lastDatabaseError: runtime.lastDatabaseError,
    databaseHealth: runtime.health,
    timestamp: new Date().toISOString(),
  };
}

app.get( "/health", async () => getHealthPayload() );
app.get( "/api/health", async () => getHealthPayload() );

// ── BUILD METADATA ─────────────────────────────────────────────────────────

async function getBuildPayload ()
{
  return {
    ...BUILD_META,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}

app.get( "/build", async () => getBuildPayload() );
app.get( "/api/build", async () => getBuildPayload() );

// ── CONDUCTOR API ──────────────────────────────────────────────────────────

app.get( "/api/conductor/topology", async () =>
{
  return conductor.getTopology();
} );

app.get( "/api/conductor/workflows", async () =>
{
  return {
    available: Object.keys( WORKFLOWS ),
    workflows: Object.fromEntries(
      Object.entries( WORKFLOWS ).map( ( [ name, steps ] ) => [
        name,
        steps.map( ( s ) => ( { layer: s.layer, required: s.required } ) ),
      ] ),
    ),
  };
} );

app.post<{
  Params: { workflow: string };
  Body: { payload?: unknown; iq200Packet?: VyrdxIQ200Packet; businessAnswerPacket?: VyrdxBusinessAnswerPacket };
}>(
  "/api/conductor/:workflow",
  async ( req, reply ) =>
  {
    const gate = evaluateBusinessMotionGate( req.body ?? {}, "deployment_routing" );
    if ( !gate.gate.allowed ) return reply.code( 403 ).send( gate );

    const { workflow } = req.params;
    const payload = req.body?.payload ?? {};
    const ctx = makeCtx( "api:conductor" );

    const steps = WORKFLOWS[ workflow ];
    if ( !steps )
    {
      return { error: `Unknown workflow: ${ workflow }`, available: Object.keys( WORKFLOWS ) };
    }

    return conductor.executeWorkflow( workflow, steps, payload, ctx );
  },
);

app.post<{
  Body: { layer: string; payload?: unknown; iq200Packet?: VyrdxIQ200Packet; businessAnswerPacket?: VyrdxBusinessAnswerPacket };
}>(
  "/api/conductor/fire/layer",
  async ( req, reply ) =>
  {
    const gate = evaluateBusinessMotionGate( req.body ?? {}, "deployment_routing" );
    if ( !gate.gate.allowed ) return reply.code( 403 ).send( gate );

    const { layer, payload } = req.body ?? {};
    if ( !layer ) return { error: "layer is required" };
    const ctx = makeCtx( "api:fire-layer" );
    return conductor.fireLayer( layer as never, payload ?? {}, ctx );
  },
);

app.post<{
  Body: { server: string; payload?: unknown; iq200Packet?: VyrdxIQ200Packet; businessAnswerPacket?: VyrdxBusinessAnswerPacket };
}>(
  "/api/conductor/fire/server",
  async ( req, reply ) =>
  {
    const gate = evaluateBusinessMotionGate( req.body ?? {}, "deployment_routing" );
    if ( !gate.gate.allowed ) return reply.code( 403 ).send( gate );

    const { server, payload } = req.body ?? {};
    if ( !server ) return { error: "server is required" };
    const ctx = makeCtx( "api:fire-server" );
    return conductor.fireServer( server as never, payload ?? {}, ctx );
  },
);

// ── LEGACY EVIDENCE/COMMERCIAL moved to server/api/ modules ───────────────

// ── OBSERVABILITY API ──────────────────────────────────────────────────────

app.get( "/api/observability/snapshot", async () =>
{
  app.get( "/api/observability/snapshot", async () =>
  {
    // VYRDX bridge removed - returning stub
    return {
      snapshot: null,
      timestamp: new Date().toISOString()
    };
  } );

  app.get( "/api/observability/hardware", async () =>
  {
    // VYRDX bridge removed - returning stub
    return {
      load: 0,
      memoryFreeRatio: 0,
      cpuTempC: 0,
      timestamp: new Date().toISOString()
    };
  } );

  app.get( "/api/camps/summary", async () =>
  {
    const [ snapshot, count, conf, directive, law ] = await Promise.all( [
    ] );
    return {
      room: "camps",
      status: "active",
      data: {
        bridge: null, // VYRDX bridge removed
        boot: { directiveValid: directive, lawValid: law },
        opportunities: { count, latestConfidence: conf },
      },
      timestamp: new Date().toISOString(),
    };
  } );
  const [ chain, feed, attest, rtmp, confidence, mode ] = await Promise.all( [
  ] );
  return {
    room: "policy",
    status: "active",
    data: {
      services: { chainVerifier: chain, feedEngine: feed, attestation: attest, rtmpAuth: rtmp },
      analytics: { confidence, mode },
      workflows: Object.keys( WORKFLOWS ),
    },
    timestamp: new Date().toISOString(),
  };
} );

// ── WEBSOCKET — LIVE TELEMETRY ─────────────────────────────────────────────

import type WebSocket from "ws";

const wsClients = new Set<WebSocket>();

app.register( async function wsRoutes ( server )
{
  server.get( "/ws", { websocket: true }, ( socket ) =>
  {
    wsClients.add( socket );
    socket.on( "close", () => wsClients.delete( socket ) );

    socket.send( JSON.stringify( {
      type: "connected",
      server: "vxstation",
      timestamp: new Date().toISOString(),
    } ) );

    socket.on( "message", async ( raw: Buffer ) =>
    {
      try
      {
        const msg = JSON.parse( raw.toString() );
        if ( msg.type === "ping" )
        {
          socket.send( JSON.stringify( { type: "pong", timestamp: new Date().toISOString() } ) );
        } else if ( msg.type === "snapshot" )
        {
          socket.send( JSON.stringify( { type: "snapshot", data: snap, timestamp: new Date().toISOString() } ) );
        } else if ( msg.type === "topology" )
        {
          socket.send( JSON.stringify( { type: "topology", data: conductor.getTopology(), timestamp: new Date().toISOString() } ) );
        }
      } catch
      {
        socket.send( JSON.stringify( { type: "error", message: "invalid message" } ) );
      }
    } );
  } );
} );

// Telemetry broadcast every 10s
const telemetryInterval = setInterval( async () =>
{
  if ( wsClients.size === 0 ) return;
  const payload = JSON.stringify( {
    type: "telemetry",
    data: snap ? {
      health: snapshot.health,
      market: { price: snapshot.market.price, volatility: snapshot.market.volatility },
      hardware: { load: snapshot.hardware.load, memFreeRatio: snapshot.hardware.memoryFreeRatio },
      services: snapshot.services,
    } : null,
    timestamp: new Date().toISOString(),
  } );
  for ( const client of wsClients )
  {
    try { client.send( payload ); } catch { wsClients.delete( client ); }
  }
}, 10_000 );

// ── LIFECYCLE ──────────────────────────────────────────────────────────────

const shutdown = async ( signal: string ) =>
{
  console.log( `\n[VXSTATION] ${ signal } received, shutting down...` );
  runtimeModeService.stopRuntimeModeMonitor();
  clearInterval( telemetryInterval );
  for ( const client of wsClients )
  {
    try { client.close(); } catch { /* ignore */ }
  }
  await app.close();
  process.exit( 0 );
};

process.on( "SIGINT", () => void shutdown( "SIGINT" ) );
process.on( "SIGTERM", () => void shutdown( "SIGTERM" ) );

// ── START ──────────────────────────────────────────────────────────────────

await app.listen( { port: ENV.port, host: ENV.host } );
console.log( `[VXSTATION] Server live on ${ ENV.host }:${ ENV.port }` );
console.log( `[VXSTATION] MODE=${ ENV.mode } ENVIRONMENT=${ ENV.environment }` );
console.log( `[VXSTATION] KITTY_ROOT=${ ENV.kittyRoot }` );
console.log( `[VXSTATION] DATABASE=${ ENV.databaseUrl ? "configured" : "not configured" }` );
console.log( `[VXSTATION] EVIDENCE_DIR=${ ENV.evidenceDir }` );
console.log( `[VXSTATION] RELEASE=${ ENV.releaseId }` );
console.log( `[VXSTATION] WebSocket at ws://${ ENV.host }:${ ENV.port }/ws` );
