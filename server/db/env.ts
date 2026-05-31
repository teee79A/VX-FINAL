export type DbSslMode = "disable" | "require";

export interface DbRuntimeEnv {
  databaseUrl: string | null;
  poolMin: number;
  poolMax: number;
  sslMode: DbSslMode;
  isConfigured: boolean;
  configError: string | null;
}

function parsePositiveInt(raw: string | undefined, fallback: number, label: string): {
  value: number;
  error: string | null;
} {
  if (!raw || raw.trim().length === 0) {
    return { value: fallback, error: null };
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return { value: fallback, error: `${label} must be a positive integer` };
  }
  return { value: parsed, error: null };
}

function parseSslMode(raw: string | undefined): {
  value: DbSslMode;
  error: string | null;
} {
  if (!raw || raw.trim().length === 0) {
    return { value: "disable", error: null };
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "disable" || normalized === "require") {
    return { value: normalized, error: null };
  }
  return { value: "disable", error: "DB_SSL_MODE must be either 'disable' or 'require'" };
}

function parseDatabaseUrl(raw: string | undefined): {
  value: string | null;
  error: string | null;
} {
  if (!raw || raw.trim().length === 0) {
    return { value: null, error: "DATABASE_URL is not configured" };
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
      return { value: null, error: "DATABASE_URL must use postgres:// or postgresql:// scheme" };
    }
    return { value: raw, error: null };
  } catch {
    return { value: null, error: "DATABASE_URL is malformed" };
  }
}

export function loadDbRuntimeEnv(): DbRuntimeEnv {
  const database = parseDatabaseUrl(process.env.DATABASE_URL);
  const min = parsePositiveInt(process.env.DB_POOL_MIN, 1, "DB_POOL_MIN");
  const max = parsePositiveInt(process.env.DB_POOL_MAX, 10, "DB_POOL_MAX");
  const ssl = parseSslMode(process.env.DB_SSL_MODE);

  const errorParts = [database.error, min.error, max.error, ssl.error].filter((value): value is string => Boolean(value));
  if (min.value > max.value) {
    errorParts.push("DB_POOL_MIN must be less than or equal to DB_POOL_MAX");
  }

  return {
    databaseUrl: database.value,
    poolMin: min.value,
    poolMax: max.value,
    sslMode: ssl.value,
    isConfigured: database.value !== null && errorParts.length === 0,
    configError: errorParts.length > 0 ? errorParts.join("; ") : null,
  };
}

export const DB_RUNTIME_ENV = loadDbRuntimeEnv();

