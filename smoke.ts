import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import Fastify from "fastify";
import type { getLaunchRoomState } from "../../server/vyrdx/domain/launch-events.js";

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;

if (isDirectRun && process.env["VYRDX_SMOKE_TSX_BOOTSTRAPPED"] !== "1") {
  const tsxBin = join(process.cwd(), "node_modules", ".bin", "tsx");
  const spawned = spawnSync(tsxBin, [process.argv[1] ?? ""], {
    env: { ...process.env, VYRDX_SMOKE_TSX_BOOTSTRAPPED: "1" },
    stdio: "inherit",
  });
  if (spawned.error) {
    console.error(JSON.stringify({ ok: false, error: "SMOKE_TSX_BOOTSTRAP_FAILED" }));
    process.exit(1);
  }
  process.exit(spawned.status ?? 1);
}

type LaunchRoomState = ReturnType<typeof getLaunchRoomState>;

export interface LaunchSmokeResult {
  ok: boolean;
  commit: string;
  evidenceLog: string;
  steps: Record<string, unknown>;
  rooms: {
    launchRuntime: LaunchRoomState;
    launchRevenue: LaunchRoomState;
    launchFeedback: LaunchRoomState;
  };
}

export interface LaunchSmokeOptions {
  requirePaymentSuccess?: boolean;
}

export async function runLaunchSmoke(options: LaunchSmokeOptions = {}): Promise<LaunchSmokeResult> {
  const [
    { ensureSchemaVersion, getPool, migrateSchema },
    { registerPaymentRoutes },
    { registerVyrdxBusinessMotionRoutes },
    { registerVyrdxLaunchMonitorRoutes },
    { evaluateBusinessMotionGate },
    { evaluateVyrdxGate },
    { getLaunchRoomState, resetLaunchEventsForTest },
    { allRuntimeConfigChecks },
    { runtimeModeService },
    { ingestFlyerFeedback, resetFlyerBotStateForTest },
    { makeIQ200Packet, makeQ201Packet },
  ] = await Promise.all([
    import("../../server/db.js"),
    import("../../server/api/payments.js"),
    import("../../server/vyrdx/api/business-motions.js"),
    import("../../server/vyrdx/api/launch-monitor.js"),
    import("../../server/vyrdx/domain/business-motion-gate.js"),
    import("../../server/vyrdx/domain/gate.js"),
    import("../../server/vyrdx/domain/launch-events.js"),
    import("../../server/vyrdx/domain/runtime-config.js"),
    import("../../server/services/runtimeModeService.js"),
    import("../../vyrden-airoom/src/bots/flyer-distribution.js"),
    import("../../tests/helpers/vyrdx-business-packets.js"),
  ]);
  const requirePaymentSuccess = options.requirePaymentSuccess ?? true;
  const root = mkdtempSync(join(tmpdir(), "vyrdx-launch-smoke-"));
  process.env["VYRDX_LAUNCH_EVENT_LOG"] = process.env["VYRDX_LAUNCH_EVENT_LOG"] || join(root, "events.jsonl");
  process.env["VYRDEN_FLYER_STATE_DIR"] = process.env["VYRDEN_FLYER_STATE_DIR"] || join(root, "flyer");
  resetLaunchEventsForTest();
  resetFlyerBotStateForTest();

  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).trim();
  const iq200 = makeIQ200Packet(90);
  const q201Crm = makeQ201Packet(iq200, "CRM_READY");
  const q201Payment = makeQ201Packet(iq200, "PAYMENT_READY");

  const dbBootstrap = await bootstrapPaymentDbForSmoke("ws_launch_smoke", {
    ensureSchemaVersion,
    getPool,
    migrateSchema,
    runtimeModeService,
  });

  const intake = evaluateVyrdxGate({
    action: "verify_new_claim",
    requesterEmail: "pilot@example.com",
    requesterName: "Pilot Buyer",
    requesterRole: "requester",
    organization: "Agency Alpha",
    authorityDeclaration: true,
    scopeType: "READINESS_AUDIT",
    scopeDescription: "Bounded IQ200 launch audit for one digital marketing agency.",
    claim: "Agency needs evidence-backed revenue pilot before payment.",
    transactionId: "launch-smoke-001",
    selectedStandardId: "VYRDX-GATE-006",
    evidenceUrls: ["https://vyrdx.vyrdon.com/proof/launch-smoke"],
  });

  const crmGate = evaluateBusinessMotionGate({ iq200Packet: iq200, businessAnswerPacket: q201Crm }, "crm_write");
  const paymentGate = evaluateBusinessMotionGate({ iq200Packet: iq200, businessAnswerPacket: q201Payment }, "payment");

  const app = Fastify();
  await registerVyrdxBusinessMotionRoutes(app);
  await registerVyrdxLaunchMonitorRoutes(app);
  await registerPaymentRoutes(app);

  try {
    const crm = await app.inject({
      method: "POST",
      url: "/api/vyrdx/business/crm/upsert",
      payload: {
        iq200Packet: iq200,
        businessAnswerPacket: q201Crm,
      },
    });

    const payment = await app.inject({
      method: "POST",
      url: "/api/v1/payments/request",
      payload: {
        workspaceId: "ws_launch_smoke",
        productCode: "business",
        offerCode: "VYRDX_REVENUE_PILOT",
        paymentMethod: "paypal",
        paymentMetadata: {
          pilotId: "pilot_launch_smoke",
          channel: "email",
          assetVersion: "v1",
        },
        iq200Packet: iq200,
        businessAnswerPacket: q201Payment,
      },
    });

    const feedback = ingestFlyerFeedback({
      pilotId: "pilot_launch_smoke",
      channel: "email",
      contact: "pilot@example.com",
      message: "Interested, can we book a call?",
      source: "launch-smoke",
    });

    const revenueRoom = await app.inject({
      method: "GET",
      url: "/api/vyrdx/launch/rooms/launch-revenue",
    });

    const feedbackRoom = await app.inject({
      method: "GET",
      url: "/api/vyrdx/launch/rooms/launch-feedback",
    });

    const paymentRouteSucceeded = payment.statusCode === 200 || payment.statusCode === 201;

    return {
      ok: intake.ok && crmGate.decision === "ALLOWED" && paymentGate.decision === "ALLOWED"
        && [200, 503].includes(crm.statusCode)
        && (requirePaymentSuccess ? paymentRouteSucceeded : [200, 201, 503].includes(payment.statusCode))
        && feedback.ok
        && revenueRoom.statusCode === 200
        && feedbackRoom.statusCode === 200,
      commit,
      evidenceLog: process.env["VYRDX_LAUNCH_EVENT_LOG"] ?? "",
      steps: {
        intake,
        iq200: { state: iq200.gateResult.state, weightedScore: iq200.iqScore.weightedScore },
        q201: { crmState: q201Crm["code/state"].gateState, paymentState: q201Payment["code/state"].gateState },
        runtimeConfig: allRuntimeConfigChecks(),
        dbBootstrap,
        crm: { gate: crmGate.decision, routeStatus: crm.statusCode, body: crm.json() },
        payment: { gate: paymentGate.decision, routeStatus: payment.statusCode, body: payment.json() },
        feedback,
      },
      rooms: {
        launchRuntime: getLaunchRoomState("launch-runtime"),
        launchRevenue: revenueRoom.json() as LaunchRoomState,
        launchFeedback: feedbackRoom.json() as LaunchRoomState,
      },
    };
  } finally {
    await app.close();
  }
}

async function bootstrapPaymentDbForSmoke(
  workspaceId: string,
  deps: {
    ensureSchemaVersion: typeof import("../../server/db.js").ensureSchemaVersion;
    getPool: typeof import("../../server/db.js").getPool;
    migrateSchema: typeof import("../../server/db.js").migrateSchema;
    runtimeModeService: typeof import("../../server/services/runtimeModeService.js").runtimeModeService;
  },
): Promise<Record<string, unknown>> {
  const { ensureSchemaVersion, getPool, migrateSchema, runtimeModeService } = deps;
  if (!process.env["DATABASE_URL"]?.trim()) {
    return {
      ok: false,
      reason: "DATABASE_URL_NOT_CONFIGURED",
      migrations: "skipped",
    };
  }

  const logger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };

  await migrateSchema();
  await ensureSchemaVersion();
  await runtimeModeService.refreshRuntimeMode(logger);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO workspaces (id, slug, name, plan, updated_at)
       VALUES ($1, $2, $3, 'business', now())
       ON CONFLICT (id) DO UPDATE
         SET slug = EXCLUDED.slug,
             name = EXCLUDED.name,
             plan = EXCLUDED.plan,
             updated_at = now()`,
      [workspaceId, "launch-smoke", "VYRDX Launch Smoke"],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  return {
    ok: true,
    migrations: "applied",
    workspaceId,
    runtimeMode: runtimeModeService.getRuntimeModeSnapshot().runtimeMode,
  };
}

if (isDirectRun) {
  const result = await runLaunchSmoke();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
