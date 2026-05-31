import { describe, expect, it } from "vitest";
import {
  isZeroTrustServiceTokenConfigured,
  requiresZeroTrustGuard,
  ZERO_TRUST_PROTECTED_ROUTE_PATTERNS,
} from "../server/security/zero-trust.js";

describe("zero trust guard contract", () => {
  it("protects critical mutation routes", () => {
    expect(requiresZeroTrustGuard("POST", "/api/conductor/fire/layer")).toBe(true);
    expect(requiresZeroTrustGuard("POST", "/api/commercial/receipts/generate")).toBe(true);
    expect(requiresZeroTrustGuard("POST", "/api/room-contract/rooms/market/actions")).toBe(true);
    expect(requiresZeroTrustGuard("POST", "/api/v1/seals")).toBe(true);
    expect(requiresZeroTrustGuard("POST", "/api/v1/seals/abc/revoke")).toBe(true);
  });

  it("does not protect read routes or public-safe writes", () => {
    expect(requiresZeroTrustGuard("GET", "/api/conductor/topology")).toBe(false);
    expect(requiresZeroTrustGuard("GET", "/api/room-contract/rooms/system")).toBe(false);
    expect(requiresZeroTrustGuard("POST", "/api/v1/payments/request")).toBe(false);
  });

  it("detects service token configuration", () => {
    expect(isZeroTrustServiceTokenConfigured({})).toBe(false);
    expect(isZeroTrustServiceTokenConfigured({ CF_ACCESS_CLIENT_ID: "id-only" } as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isZeroTrustServiceTokenConfigured({
        CF_ACCESS_CLIENT_ID: "id.access",
        CF_ACCESS_CLIENT_SECRET: "secret",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("keeps the protected route pattern list non-empty", () => {
    expect(ZERO_TRUST_PROTECTED_ROUTE_PATTERNS.length).toBeGreaterThan(0);
  });
});

