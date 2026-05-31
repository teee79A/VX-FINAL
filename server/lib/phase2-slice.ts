import { ENV } from "../env.js";

type Phase2FetchOptions = {
  includeAuth?: boolean;
  includeWorkspace?: boolean;
  timeoutMs?: number;
};

type Phase2ReceiptList = {
  receipts: Array<{
    receiptId: string;
    orderId: string;
    customerId: string;
    email: string;
    currency: string;
    amount: number;
    status: string;
    issuedAt: string;
    createdAt: string;
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
};

type Phase2ReceiptDetail = {
  receipt: {
    receiptId: string;
    orderId: string;
    customerId: string;
    email: string;
    currency: string;
    amount: number;
    status: string;
    issuedAt: string;
    createdAt: string;
  };
  order?: Record<string, unknown> | null;
  proof?: {
    recordHash?: string | null;
    eventHash?: string | null;
    artifactHash?: string | null;
    manifestId?: string | number | null;
    manifestHash?: string | null;
    signerId?: string | null;
    signature?: string | null;
    timestamp?: string | null;
    refs?: {
      proofByReceipt?: string | null;
      proofByHash?: string | null;
      manifestDetail?: string | null;
    };
  } | null;
};

type Phase2EvidenceProof = {
  entityType: string;
  entityId: string;
  artifactHash?: string | null;
  recordHash?: string | null;
  eventHash?: string | null;
  manifestId?: string | number | null;
  manifestHash?: string | null;
  signerId?: string | null;
  signature?: string | null;
  timestamp?: string | null;
  status?: string | null;
  refs?: {
    proofByEntity?: string | null;
    proofByHash?: string | null;
    manifestDetail?: string | null;
  };
};

type Phase2ManifestDetail = {
  manifest: {
    manifestId: string | number;
    manifestHash: string;
    recordCount: number;
    createdAt: string;
  };
  attestation?: {
    signerId: string;
    signature: string;
    attestedAt: string;
  } | null;
  records?: Array<Record<string, unknown>>;
};

type Phase2ServiceSnapshot = {
  service: string;
  status: "healthy" | "degraded" | "down";
  detail: Record<string, unknown>;
  checkedAt: string;
  statusUrl: string;
};

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function buildHeaders(includeAuth: boolean, includeWorkspace: boolean): Headers {
  const headers = new Headers();
  if (includeAuth && ENV.phase2ApiAuthToken.trim()) {
    headers.set("authorization", `Bearer ${ENV.phase2ApiAuthToken.trim()}`);
  }
  if (includeWorkspace && ENV.phase2WorkspaceId.trim()) {
    headers.set("x-vyrdx-workspace-id", ENV.phase2WorkspaceId.trim());
  }
  return headers;
}

function assertPhase2Enabled(): void {
  if (!ENV.phase2SliceEnabled) {
    throw new Error("phase2_slice_disabled");
  }
}

function assertPhase2AuthToken(): void {
  if (!ENV.phase2ApiAuthToken.trim()) {
    throw new Error("phase2_api_auth_token_missing");
  }
}

async function fetchPhase2Json<T>(
  baseUrl: string,
  path: string,
  options: Phase2FetchOptions = {},
): Promise<T> {
  assertPhase2Enabled();
  const includeAuth = options.includeAuth ?? true;
  const includeWorkspace = options.includeWorkspace ?? false;
  const timeoutMs = options.timeoutMs ?? 5_000;

  if (includeAuth) {
    assertPhase2AuthToken();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
      headers: buildHeaders(includeAuth, includeWorkspace),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`phase2_request_failed:${response.status}:${path}:${body.slice(0, 200)}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function isPhase2SliceEnabled(): boolean {
  return ENV.phase2SliceEnabled;
}

export async function listPhase2CommercialReceipts(
  page = 1,
  limit = 50,
): Promise<Phase2ReceiptList> {
  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const safeLimit = Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.floor(limit))) : 50;
  return fetchPhase2Json<Phase2ReceiptList>(
    ENV.phase2CommercialApiUrl,
    `/receipts?page=${safePage}&limit=${safeLimit}`,
    { includeAuth: true, includeWorkspace: true },
  );
}

export async function getPhase2CommercialReceiptDetail(receiptId: string): Promise<Phase2ReceiptDetail> {
  return fetchPhase2Json<Phase2ReceiptDetail>(
    ENV.phase2CommercialApiUrl,
    `/receipts/${encodeURIComponent(receiptId)}`,
    { includeAuth: true, includeWorkspace: true },
  );
}

export async function getPhase2EvidenceProofByReceipt(receiptId: string): Promise<Phase2EvidenceProof> {
  return fetchPhase2Json<Phase2EvidenceProof>(
    ENV.phase2EvidenceApiUrl,
    `/proof/receipt/${encodeURIComponent(receiptId)}`,
    { includeAuth: true },
  );
}

export async function getPhase2EvidenceProofByHash(recordHash: string): Promise<Phase2EvidenceProof> {
  return fetchPhase2Json<Phase2EvidenceProof>(
    ENV.phase2EvidenceApiUrl,
    `/proof/hash/${encodeURIComponent(recordHash)}`,
    { includeAuth: true },
  );
}

export async function getPhase2EvidenceManifestDetail(manifestId: string): Promise<Phase2ManifestDetail> {
  return fetchPhase2Json<Phase2ManifestDetail>(
    ENV.phase2EvidenceApiUrl,
    `/manifests/${encodeURIComponent(manifestId)}`,
    { includeAuth: true },
  );
}

export async function getPhase2EvidenceStatus(): Promise<Record<string, unknown>> {
  return fetchPhase2Json<Record<string, unknown>>(
    ENV.phase2EvidenceApiUrl,
    "/status",
    { includeAuth: true },
  );
}

export async function getPhase2PaymentWebhookStatus(): Promise<Record<string, unknown>> {
  return fetchPhase2Json<Record<string, unknown>>(
    ENV.phase2PaymentWebhookUrl,
    "/status",
    { includeAuth: false },
  );
}

async function getPhase2WorkerStatus(url: string): Promise<Record<string, unknown>> {
  return fetchPhase2Json<Record<string, unknown>>(url, "/status", { includeAuth: false });
}

function deriveServiceStatus(payload: Record<string, unknown> | null): "healthy" | "degraded" | "down" {
  if (!payload) return "down";

  const totals = payload["totals"];
  if (totals && typeof totals === "object" && !Array.isArray(totals)) {
    const record = totals as Record<string, unknown>;
    const errored = Number(record["erroredEvents"] ?? 0);
    if (Number.isFinite(errored) && errored > 0) return "degraded";
  }

  const status = payload["status"];
  if (status && typeof status === "object" && !Array.isArray(status)) {
    const record = status as Record<string, unknown>;
    const failures = Number(
      record["failures"] ??
      record["failedEvents"] ??
      record["failureCount"] ??
      0,
    );
    if (Number.isFinite(failures) && failures > 0) return "degraded";
  }

  return "healthy";
}

export async function getPhase2OpsSupportStatus(): Promise<Phase2ServiceSnapshot[]> {
  assertPhase2Enabled();
  const checkedAt = new Date().toISOString();

  const sources = [
    { service: "payment-webhook", url: ENV.phase2PaymentWebhookUrl },
    { service: "receipt-worker", url: ENV.phase2ReceiptWorkerStatusUrl },
    { service: "evidence-hash-worker", url: ENV.phase2EvidenceHashWorkerStatusUrl },
    { service: "evidence-manifest-worker", url: ENV.phase2EvidenceManifestWorkerStatusUrl },
    { service: "attestation-signer", url: ENV.phase2AttestationSignerStatusUrl },
    { service: "smtp-worker", url: ENV.phase2SmtpWorkerStatusUrl },
  ] as const;

  const snapshots = await Promise.all(
    sources.map(async ({ service, url }) => {
      try {
        const detail = service === "payment-webhook"
          ? await getPhase2PaymentWebhookStatus()
          : await getPhase2WorkerStatus(url);
        return {
          service,
          status: deriveServiceStatus(detail),
          detail,
          checkedAt,
          statusUrl: `${normalizeBaseUrl(url)}/status`,
        } satisfies Phase2ServiceSnapshot;
      } catch (error) {
        return {
          service,
          status: "down",
          detail: {
            error: error instanceof Error ? error.message : String(error),
          },
          checkedAt,
          statusUrl: `${normalizeBaseUrl(url)}/status`,
        } satisfies Phase2ServiceSnapshot;
      }
    }),
  );

  return snapshots;
}
