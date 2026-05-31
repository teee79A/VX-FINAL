import { dbHealthy, getSchemaVersion, query, REQUIRED_SCHEMA_VERSION } from "../db.js";
import { DB_RUNTIME_ENV } from "./env.js";

export interface DatabaseHealthReport {
  configured: boolean;
  reachable: boolean;
  migrated: boolean;
  criticalTablesPresent: boolean;
  schemaVersion: number | null;
  requiredSchemaVersion: number;
  missingTables: string[];
  lastError: string | null;
}

const CRITICAL_TABLES = [
  "room_registry",
  "room_summary",
  "room_status_reasons",
  "room_change_events",
  "room_actions",
  "commercial_entitlements",
  "commercial_certificates",
  "evidence_ledger",
  "market_targets",
  "market_snapshots",
  "system_boundary_state",
] as const;

export async function probeDatabaseHealth(): Promise<DatabaseHealthReport> {
  if (!DB_RUNTIME_ENV.isConfigured) {
    return {
      configured: false,
      reachable: false,
      migrated: false,
      criticalTablesPresent: false,
      schemaVersion: null,
      requiredSchemaVersion: REQUIRED_SCHEMA_VERSION,
      missingTables: [...CRITICAL_TABLES],
      lastError: DB_RUNTIME_ENV.configError ?? "database_not_configured",
    };
  }

  try {
    const reachable = await dbHealthy();
    if (!reachable) {
      return {
        configured: true,
        reachable: false,
        migrated: false,
        criticalTablesPresent: false,
        schemaVersion: null,
        requiredSchemaVersion: REQUIRED_SCHEMA_VERSION,
        missingTables: [...CRITICAL_TABLES],
        lastError: "database_unreachable",
      };
    }

    const missing = await query<{ missing_table: string }>(
      `SELECT expected.missing_table
         FROM unnest($1::text[]) AS expected(missing_table)
        WHERE NOT EXISTS (
          SELECT 1
            FROM information_schema.tables t
           WHERE t.table_schema = 'public'
             AND t.table_name = expected.missing_table
        )`,
      [CRITICAL_TABLES],
    );
    const missingTables = missing.map((row) => row.missing_table);
    const schemaVersion = await getSchemaVersion();
    const criticalTablesPresent = missingTables.length === 0;
    const migrated = criticalTablesPresent && schemaVersion !== null && schemaVersion >= REQUIRED_SCHEMA_VERSION;

    return {
      configured: true,
      reachable: true,
      migrated,
      criticalTablesPresent,
      schemaVersion,
      requiredSchemaVersion: REQUIRED_SCHEMA_VERSION,
      missingTables,
      lastError: migrated
        ? null
        : !criticalTablesPresent
          ? "critical_tables_missing"
          : "schema_version_stale",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "database_probe_failed";
    return {
      configured: true,
      reachable: false,
      migrated: false,
      criticalTablesPresent: false,
      schemaVersion: null,
      requiredSchemaVersion: REQUIRED_SCHEMA_VERSION,
      missingTables: [...CRITICAL_TABLES],
      lastError: message,
    };
  }
}

