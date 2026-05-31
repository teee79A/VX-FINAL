import { ensureSchemaVersion, migrateSchema } from "../db.js";
import { probeDatabaseHealth, type DatabaseHealthReport } from "./health.js";
import { DB_RUNTIME_ENV } from "./env.js";

export type RuntimeMode = "primary_db" | "degraded_read_only";

export interface RuntimeModeSnapshot {
  isDatabaseConfigured: boolean;
  isDatabaseHealthy: boolean;
  runtimeMode: RuntimeMode;
  lastDatabaseError: string | null;
  health: DatabaseHealthReport;
  updatedAtUtc: string;
}

interface LoggerLike {
  info: (msg: string | Record<string, unknown>, maybeMsg?: string) => void;
  warn: (msg: string | Record<string, unknown>, maybeMsg?: string) => void;
  error: (msg: string | Record<string, unknown>, maybeMsg?: string) => void;
}

let snapshot: RuntimeModeSnapshot = {
  isDatabaseConfigured: DB_RUNTIME_ENV.isConfigured,
  isDatabaseHealthy: false,
  runtimeMode: "degraded_read_only",
  lastDatabaseError: DB_RUNTIME_ENV.configError ?? "runtime_not_bootstrapped",
  health: {
    configured: DB_RUNTIME_ENV.isConfigured,
    reachable: false,
    migrated: false,
    criticalTablesPresent: false,
    schemaVersion: null,
    requiredSchemaVersion: 20260421,
    missingTables: [],
    lastError: DB_RUNTIME_ENV.configError ?? "runtime_not_bootstrapped",
  },
  updatedAtUtc: new Date().toISOString(),
};

let monitorHandle: NodeJS.Timeout | null = null;

function toSnapshot(health: DatabaseHealthReport): RuntimeModeSnapshot {
  const primaryDb = health.configured && health.reachable && health.migrated;
  return {
    isDatabaseConfigured: health.configured,
    isDatabaseHealthy: primaryDb,
    runtimeMode: primaryDb ? "primary_db" : "degraded_read_only",
    lastDatabaseError: primaryDb ? null : health.lastError ?? "database_not_ready",
    health,
    updatedAtUtc: new Date().toISOString(),
  };
}

export function getRuntimeModeSnapshot(): RuntimeModeSnapshot {
  return snapshot;
}

export async function bootstrapRuntimeMode(logger: LoggerLike): Promise<RuntimeModeSnapshot> {
  if (!DB_RUNTIME_ENV.isConfigured) {
    const health = await probeDatabaseHealth();
    snapshot = toSnapshot(health);
    logger.warn(
      { runtimeMode: snapshot.runtimeMode, reason: snapshot.lastDatabaseError },
      "DB bootstrap: configuration missing or invalid; running degraded_read_only",
    );
    return snapshot;
  }

  try {
    await migrateSchema();
    await ensureSchemaVersion();
  } catch (error) {
    const message = error instanceof Error ? error.message : "migration_failed";
    logger.error({ err: message }, "DB bootstrap: migration failed; switching to degraded_read_only");
  }

  const health = await probeDatabaseHealth();
  snapshot = toSnapshot(health);
  if (snapshot.runtimeMode === "primary_db") {
    logger.info(
      {
        runtimeMode: snapshot.runtimeMode,
        schemaVersion: snapshot.health.schemaVersion,
        requiredSchemaVersion: snapshot.health.requiredSchemaVersion,
      },
      "DB bootstrap: primary_db enabled",
    );
  } else {
    logger.warn(
      {
        runtimeMode: snapshot.runtimeMode,
        reason: snapshot.lastDatabaseError,
        missingTables: snapshot.health.missingTables,
        schemaVersion: snapshot.health.schemaVersion,
        requiredSchemaVersion: snapshot.health.requiredSchemaVersion,
      },
      "DB bootstrap: degraded_read_only",
    );
  }
  return snapshot;
}

export async function refreshRuntimeMode(logger?: LoggerLike): Promise<RuntimeModeSnapshot> {
  const health = await probeDatabaseHealth();
  const next = toSnapshot(health);
  const modeChanged = next.runtimeMode !== snapshot.runtimeMode;
  snapshot = next;

  if (modeChanged && logger) {
    logger.warn(
      {
        runtimeMode: snapshot.runtimeMode,
        reason: snapshot.lastDatabaseError,
      },
      "Runtime mode changed",
    );
  }
  return snapshot;
}

export function startRuntimeModeMonitor(logger: LoggerLike, intervalMs: number = 30_000): void {
  if (monitorHandle) {
    clearInterval(monitorHandle);
  }
  monitorHandle = setInterval(() => {
    void refreshRuntimeMode(logger);
  }, intervalMs);
  monitorHandle.unref?.();
}

export function stopRuntimeModeMonitor(): void {
  if (monitorHandle) {
    clearInterval(monitorHandle);
    monitorHandle = null;
  }
}

export class RuntimeModeError extends Error {
  readonly code: string;
  readonly reason: string | null;
  readonly scope: "write";
  readonly runtimeMode: RuntimeMode;

  constructor(runtimeMode: RuntimeMode, code: string, message: string, reason: string | null = null) {
    super(message);
    this.name = "RuntimeModeError";
    this.runtimeMode = runtimeMode;
    this.code = code;
    this.reason = reason;
    this.scope = "write";
  }
}

export function requirePrimaryDbMode(actionName: string): void {
  const current = getRuntimeModeSnapshot();
  if (current.runtimeMode !== "primary_db") {
    throw new RuntimeModeError(
      current.runtimeMode,
      "database_unavailable",
      `Action '${actionName}' requires primary_db mode`,
      current.lastDatabaseError,
    );
  }
}
