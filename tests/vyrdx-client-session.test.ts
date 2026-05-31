import { describe, expect, it } from "vitest";
import {
  clearSessionContext,
  getSessionContext,
  setSessionContext,
  type SessionContext,
  type StorageLike,
} from "../packages/vyrdx-app/src/lib/session.js";
import {
  buildCreateSealRequest,
  buildGateEvaluateRequest,
  buildPaymentHistoryUrl,
  buildPaymentRequest,
  buildUsageUrl,
  buildWorkspaceSealsUrl,
  getSignInPath,
} from "../packages/vyrdx-app/src/lib/customer-requests.js";

function createStorage(initial: Record<string, string> = {}): StorageLike {
  const state = new Map(Object.entries(initial));

  return {
    getItem(key: string) {
      return state.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      state.set(key, value);
    },
    removeItem(key: string) {
      state.delete(key);
    },
  };
}

describe("vyrdx client session", () => {
  it("reads and writes session context through storage", () => {
    const storage = createStorage();
    const session: SessionContext = {
      userId: "usr_alpha",
      workspaceId: "ws_alpha",
      email: "alpha@example.com",
    };

    setSessionContext(session, storage);

    expect(getSessionContext(storage)).toEqual(session);

    clearSessionContext(storage);

    expect(getSessionContext(storage)).toBeNull();
  });

  it("returns null when stored session payload is invalid", () => {
    const storage = createStorage({ vyrdx_session: "{broken" });

    expect(getSessionContext(storage)).toBeNull();
  });
});

describe("vyrdx customer request builders", () => {
  it("uses the active tenant workspace for usage, billing history, and certificates", () => {
    const alpha: SessionContext = { userId: "usr_alpha", workspaceId: "ws_alpha" };
    const beta: SessionContext = { userId: "usr_beta", workspaceId: "ws_beta" };

    expect(buildUsageUrl(alpha)).toBe("/api/v1/workspaces/ws_alpha/usage");
    expect(buildPaymentHistoryUrl(alpha)).toBe("/api/v1/payments/history?workspaceId=ws_alpha");
    expect(buildWorkspaceSealsUrl(alpha)).toBe("/api/v1/workspaces/ws_alpha/seals?limit=100");

    expect(buildUsageUrl(beta)).toBe("/api/v1/workspaces/ws_beta/usage");
    expect(buildPaymentHistoryUrl(beta)).toBe("/api/v1/payments/history?workspaceId=ws_beta");
    expect(buildWorkspaceSealsUrl(beta)).toBe("/api/v1/workspaces/ws_beta/seals?limit=100");
  });

  it("builds seal creation and payment request payloads from session context only", async () => {
    const session: SessionContext = { userId: "usr_alpha", workspaceId: "ws_alpha" };

    const sealRequest = buildCreateSealRequest(session, {
      title: "Milestone delivered",
      subject: "Client launch",
      description: "Homepage approved",
      metadata: { actorName: "Alpha Operator" },
      idempotencyKey: "cert_123",
    });

    expect(sealRequest.url).toBe("/api/v1/seals");
    expect(sealRequest.init.method).toBe("POST");
    expect(sealRequest.init.headers).toEqual({
      "Content-Type": "application/json",
      "x-vyrdx-origin-room": "commercial",
    });
    expect(sealRequest.init.body).toContain("\"workspaceId\":\"ws_alpha\"");
    expect(sealRequest.init.body).toContain("\"actorId\":\"usr_alpha\"");
    expect(sealRequest.init.body).toContain("\"evidenceRef\":\"commercial:ws_alpha:cert_123\"");
    expect(sealRequest.init.body).not.toContain("ws_vyrdon_hq");
    expect(sealRequest.init.body).not.toContain("usr_t79");

    const paymentRequest = buildPaymentRequest(session, "solo");

    expect(paymentRequest.url).toBe("/api/v1/payments/request");
    expect(paymentRequest.init.method).toBe("POST");
    expect(paymentRequest.init.body).toContain("\"workspaceId\":\"ws_alpha\"");
    expect(paymentRequest.init.body).toContain("\"productCode\":\"solo\"");
    expect(paymentRequest.init.body).not.toContain("ws_vyrdon_hq");
  });

  it("builds gate evaluation requests for public intake actions", () => {
    const request = buildGateEvaluateRequest({
      action: "certify_record",
      requesterEmail: "alpha@example.com",
      verifiedCaseId: "VYRDX-CASE-1",
      evidenceBundleId: "VYRDX-EVD-1",
      authorityDeclaration: true,
    });

    expect(request.url).toBe("/api/vyrdx/gate/evaluate");
    expect(request.init.method).toBe("POST");
    expect(request.init.headers).toEqual({ "Content-Type": "application/json" });
    expect(request.init.body).toContain("\"action\":\"certify_record\"");
    expect(request.init.body).toContain("\"requesterEmail\":\"alpha@example.com\"");
    expect(request.init.body).not.toContain("ws_vyrdon_hq");
  });

  it("routes missing-session users into sign-in/bootstrap flow", () => {
    expect(getSignInPath("/certify")).toBe("/signin?next=%2Fcertify");
    expect(getSignInPath("/billing")).toBe("/signin?next=%2Fbilling");
    expect(getSignInPath("my-certificates")).toBe("/signin?next=%2Fmy-certificates");
  });
});
