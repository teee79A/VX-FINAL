export const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const ZERO_TRUST_PROTECTED_ROUTE_PATTERNS: readonly RegExp[] = [
  /^\/api\/conductor(?:\/|$)/,
  /^\/api\/calendar(?:\/|$)/,
  /^\/api\/commercial(?:\/|$)/,
  /^\/api\/evidence(?:\/|$)/,
  /^\/api\/operations(?:\/|$)/,
  /^\/api\/workspace-commercial(?:\/|$)/,
  /^\/api\/room-contract\/rooms\/[^/]+\/actions$/,
  /^\/api\/v1\/payments\/confirm$/,
  /^\/api\/v1\/seals$/,
  /^\/api\/v1\/seals\/[^/]+\/revoke$/,
];

export function normalizeHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }
  if (typeof value === "string") {
    return value.trim() || null;
  }
  return null;
}

export function requiresZeroTrustGuard(method: string, rawUrl: string): boolean {
  if (!MUTATION_METHODS.has(method.toUpperCase())) {
    return false;
  }
  const pathname = rawUrl.split("?")[0] ?? rawUrl;
  return ZERO_TRUST_PROTECTED_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function isZeroTrustServiceTokenConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const id = env.CF_ACCESS_CLIENT_ID?.trim() ?? "";
  const secret = env.CF_ACCESS_CLIENT_SECRET?.trim() ?? "";
  return id.length > 0 && secret.length > 0;
}

