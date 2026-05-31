// server/api/payments.ts
// Payment request API — returns safe payment instructions (masked bank details).
// Supports PayPal (primary), Bitcoin (manual), and Bank (enterprise/manual).

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  LAUNCH_OFFERS,
  PAYMENT_CONFIG,
  PAYMENT_PROVIDERS,
  PRODUCTS,
  isValidLaunchOfferCode,
  isValidProductCode,
  normalizePaymentProvider,
} from "../config/payments.js";
import type { LaunchOfferCode, PaymentProvider, ProductCode } from "../config/payments.js";
import { maskAccount } from "../lib/mask.js";
import { getPool, query, queryOne } from "../db.js";
import {
  getCurrentBillingPeriodBounds,
  resolveConfirmedEntitlement,
} from "../lib/entitlements.js";
import { runtimeModeService } from "../services/runtimeModeService.js";
import { appendEvidenceLedgerTx } from "../lib/evidence-ledger.js";
function generateReference(): string {
  return `VYR-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function generateId(): string {
  return `pyr_${randomBytes(16).toString("hex")}`;
}

interface PaymentLaunchMetadata {
  pilotId?: string;
  channel?: string;
  assetVersion?: string;
}

interface PaymentRequestEventData {
  productCode: string;
  offerCode: string;
  paymentMetadata?: PaymentLaunchMetadata;
  paymentMethod?: string;
  paymentProvider?: PaymentProvider;
  amountCents: number;
  reference: string;
  status?: string;
}

interface PaymentRequestRow {
  id: string;
  workspace_id: string;
  event_data: string;
}

interface ProviderCreatedRow {
  id: string;
  workspace_id: string;
  event_data: string;
  created_at: string;
}

interface ConfirmPaymentResult {
  ok: true;
  confirmId: string;
  workspaceId: string;
  productCode: string;
  evidenceRef: string;
}

interface PaymentDecisionBlock {
  error: "PAYMENT_REQUEST_BLOCKED";
  decision: "BLOCKED";
  status: "FAIL_CLOSED";
  reason: string;
  requiredFields: string[];
  missingFields: string[];
  invalidFields: string[];
  validOfferCodes: string[];
  validPaymentProviders: PaymentProvider[];
  nextAction: string;
  businessGate?: ReturnType<typeof evaluateBusinessMotionGate>;
}

class PaymentHttpError extends Error {
  statusCode: number;
  payload: Record<string, unknown>;

  constructor(statusCode: number, payload: Record<string, unknown>) {
    super(String(payload["error"] ?? "payment_error"));
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

function missingPaymentMetadata(metadata: PaymentLaunchMetadata | undefined): string[] {
  const missing: string[] = [];
  if (!metadata?.pilotId?.trim()) missing.push("paymentMetadata.pilotId");
  if (!metadata?.channel?.trim()) missing.push("paymentMetadata.channel");
  if (!metadata?.assetVersion?.trim()) missing.push("paymentMetadata.assetVersion");
  return missing;
}

function missingPaymentDecisionFields(input: {
  offerCode?: string;
  paymentMethod?: string;
  paymentMetadata?: PaymentLaunchMetadata;
  iq200Packet?: VyrdxIQ200Packet;
  businessAnswerPacket?: VyrdxBusinessAnswerPacket;
}): string[] {
  const missing: string[] = [];
  if (!input.iq200Packet) missing.push("iq200Packet");
  if (!input.businessAnswerPacket) missing.push("businessAnswerPacket");
  if (!input.offerCode?.trim()) missing.push("offerCode");
  if (!input.paymentMethod?.trim()) missing.push("paymentMethod");
  missing.push(...missingPaymentMetadata(input.paymentMetadata));
  return [...new Set(missing)];
}

function paymentDecisionBlock(
  reason: string,
  missingFields: string[],
  invalidFields: string[] = [],
  businessGate?: ReturnType<typeof evaluateBusinessMotionGate>,
): PaymentDecisionBlock {
  const nextAction = missingFields.length > 0
    ? `Submit missing payment gate fields before retrying: ${missingFields.join(", ")}.`
    : `Resolve ${reason} before retrying payment provider creation.`;
  return {
    error: "PAYMENT_REQUEST_BLOCKED",
    decision: "BLOCKED",
    status: "FAIL_CLOSED",
    reason,
    requiredFields: [
      "iq200Packet",
      "businessAnswerPacket",
      "offerCode",
      "paymentMethod",
      "paymentMetadata.pilotId",
      "paymentMetadata.channel",
      "paymentMetadata.assetVersion",
    ],
    missingFields: [...new Set(missingFields)],
    invalidFields: [...new Set(invalidFields)],
    validOfferCodes: Object.keys(LAUNCH_OFFERS),
    validPaymentProviders: [...PAYMENT_PROVIDERS],
    nextAction,
    ...(businessGate ? { businessGate } : {}),
  };
}

function parsePaymentRequestData(row: PaymentRequestRow): PaymentRequestEventData {
  return JSON.parse(row.event_data) as PaymentRequestEventData;
}

function providerForPaymentData(data: PaymentRequestEventData): PaymentProvider | null {
  return data.paymentProvider ?? normalizePaymentProvider(data.paymentMethod);
}

async function loadPaymentRequest(invoiceId: string): Promise<PaymentRequestRow | null> {
  return queryOne<PaymentRequestRow>(
    `SELECT id, workspace_id, event_data::text AS event_data
       FROM billing_events
      WHERE id = $1 AND event_type = 'payment_request'`,
    [invoiceId],
  );
}

function assertInvoiceProvider(row: PaymentRequestRow, provider: PaymentProvider): PaymentRequestEventData {
  const data = parsePaymentRequestData(row);
  const invoiceProvider = providerForPaymentData(data);
  if (invoiceProvider !== provider) {
    throw new PaymentHttpError(409, {
      error: "invoice_provider_mismatch",
      invoiceId: row.id,
      expectedProvider: provider,
      actualProvider: invoiceProvider,
      status: "FAIL_CLOSED",
    });
  }
  return data;
}

async function loadProviderCreated(
  invoiceId: string,
  provider: PaymentProvider,
  providerRef?: { key: "orderId" | "address"; value: string },
): Promise<ProviderCreatedRow | null> {
  const params: unknown[] = [invoiceId, provider];
  const refClause = providerRef
    ? ` AND event_data->>'${providerRef.key}' = $3`
    : "";
  if (providerRef) {
    params.push(providerRef.value);
  }

  return queryOne<ProviderCreatedRow>(
    `SELECT id, workspace_id, event_data::text AS event_data, created_at
       FROM billing_events
      WHERE event_type = 'provider_created'
        AND event_data->>'invoiceId' = $1
        AND event_data->>'provider' = $2${refClause}
      ORDER BY created_at DESC
      LIMIT 1`,
    params,
  );
}

async function emitProviderCreatedEvent(input: {
  invoiceId: string;
  workspaceId: string;
  provider: PaymentProvider;
  eventData: Record<string, unknown>;
}): Promise<string> {
  const providerEventId = generateId();
  await query(
    `INSERT INTO billing_events (id, workspace_id, event_type, event_data, created_at)
     VALUES ($1, $2, 'provider_created', $3::jsonb, now())`,
    [
      providerEventId,
      input.workspaceId,
      JSON.stringify({
        invoiceId: input.invoiceId,
        provider: input.provider,
        status: "created",
        ...input.eventData,
      }),
    ],
  );
  return providerEventId;
}

function paypalApiBase(): string {
  return PAYMENT_CONFIG.paypal.env === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPaypalAccessToken(): Promise<string> {
  const credentials = Buffer
    .from(`${PAYMENT_CONFIG.paypal.clientId}:${PAYMENT_CONFIG.paypal.secret}`)
    .toString("base64");
  const response = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const payload = await response.json().catch(() => ({})) as { access_token?: unknown; error?: unknown };
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new PaymentHttpError(502, {
      error: "paypal_access_token_failed",
      status: "FAIL_CLOSED",
      provider: "paypal",
    });
  }
  return payload.access_token;
}

async function createPaypalOrder(input: {
  invoiceId: string;
  amountCents: number;
  reference: string;
  productCode: string;
  offerCode: string;
}): Promise<Record<string, unknown>> {
  const accessToken = await getPaypalAccessToken();
  const amountUsd = (input.amountCents / 100).toFixed(2);
  const response = await fetch(`${paypalApiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          invoice_id: input.invoiceId,
          custom_id: input.invoiceId,
          description: `${input.productCode}:${input.offerCode}`,
          amount: {
            currency_code: "USD",
            value: amountUsd,
          },
          reference_id: input.reference,
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof payload["id"] !== "string") {
    throw new PaymentHttpError(502, {
      error: "paypal_order_create_failed",
      status: "FAIL_CLOSED",
      provider: "paypal",
      paypalStatusCode: response.status,
    });
  }
  return payload;
}

async function capturePaypalOrder(orderId: string): Promise<Record<string, unknown>> {
  const accessToken = await getPaypalAccessToken();
  const response = await fetch(`${paypalApiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new PaymentHttpError(502, {
      error: "paypal_capture_failed",
      status: "FAIL_CLOSED",
      provider: "paypal",
      paypalStatusCode: response.status,
    });
  }
  return payload;
}

function getHeader(request: FastifyRequest, name: string): string {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function verifyPaypalWebhookSignature(request: FastifyRequest): Promise<boolean> {
  const body = request.body as Record<string, unknown> | undefined;
  const localSecret = PAYMENT_CONFIG.paypal.webhookSecret;
  if (localSecret) {
    const transmissionId = getHeader(request, "paypal-transmission-id");
    const transmissionTime = getHeader(request, "paypal-transmission-time");
    const signature = getHeader(request, "paypal-transmission-sig")
      || getHeader(request, "x-paypal-webhook-signature");
    if (!signature || !transmissionId || !transmissionTime) return false;

    const signedPayload = `${transmissionId}.${transmissionTime}.${JSON.stringify(body ?? {})}`;
    const expectedHex = createHmac("sha256", localSecret).update(signedPayload).digest("hex");
    const expectedBase64 = createHmac("sha256", localSecret).update(signedPayload).digest("base64");
    return safeCompare(signature, expectedHex) || safeCompare(signature, expectedBase64);
  }

  if (!PAYMENT_CONFIG.paypal.webhookId) return false;
  const accessToken = await getPaypalAccessToken();
  const response = await fetch(`${paypalApiBase()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: getHeader(request, "paypal-auth-algo"),
      cert_url: getHeader(request, "paypal-cert-url"),
      transmission_id: getHeader(request, "paypal-transmission-id"),
      transmission_sig: getHeader(request, "paypal-transmission-sig"),
      transmission_time: getHeader(request, "paypal-transmission-time"),
      webhook_id: PAYMENT_CONFIG.paypal.webhookId,
      webhook_event: body ?? {},
    }),
  });
  const payload = await response.json().catch(() => ({})) as { verification_status?: unknown };
  return response.ok && payload.verification_status === "SUCCESS";
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractPaypalWebhookLink(body: Record<string, unknown>): { invoiceId: string | null; orderId: string | null } {
  const resource = objectValue(body["resource"]);
  const supplementary = objectValue(resource["supplementary_data"]);
  const relatedIds = objectValue(supplementary["related_ids"]);
  const invoiceId = stringValue(body["invoiceId"])
    ?? stringValue(resource["invoice_id"])
    ?? stringValue(resource["custom_id"]);
  const orderId = stringValue(body["orderId"])
    ?? stringValue(resource["order_id"])
    ?? stringValue(relatedIds["order_id"])
    ?? (body["event_type"] === "CHECKOUT.ORDER.APPROVED" ? stringValue(resource["id"]) : null);
  return { invoiceId, orderId };
}

function isPaypalPaidEvent(body: Record<string, unknown>): boolean {
  return body["event_type"] === "PAYMENT.CAPTURE.COMPLETED";
}

async function confirmPaymentRequest(input: {
  paymentRequestId: string;
  confirmedBy?: string;
  provider?: PaymentProvider;
  providerReference?: string;
  providerPayload?: unknown;
}): Promise<ConfirmPaymentResult> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingRes = await client.query<{ workspace_id: string; event_data: string }>(
      `SELECT workspace_id, event_data::text AS event_data
         FROM billing_events
        WHERE id = $1 AND event_type = 'payment_request'
        FOR UPDATE`,
      [input.paymentRequestId],
    );
    const existing = existingRes.rows[0] ?? null;
    if (!existing) {
      await client.query("ROLLBACK");
      throw new PaymentHttpError(404, { error: "payment_request_not_found" });
    }

    const data = JSON.parse(existing.event_data) as PaymentRequestEventData;
    if (!isValidProductCode(data.productCode)) {
      await client.query("ROLLBACK");
      throw new PaymentHttpError(400, { error: "invalid_productCode" });
    }

    const confirmId = generateId();
    const evidenceRef = `evd_payment_confirm_${confirmId}`;

    await client.query(
      `INSERT INTO billing_events (id, workspace_id, event_type, event_data, created_at)
       VALUES ($1, $2, 'payment_confirmed', $3::jsonb, now())`,
      [confirmId, existing.workspace_id, JSON.stringify({
        paymentRequestId: input.paymentRequestId,
        productCode: data.productCode,
        amountCents: data.amountCents,
        reference: data.reference,
        confirmedBy: input.confirmedBy ?? "admin",
        ...(input.provider ? { provider: input.provider } : {}),
        ...(input.providerReference ? { providerReference: input.providerReference } : {}),
        ...(input.providerPayload ? { providerPayload: input.providerPayload } : {}),
      })],
    );

    const workspaceRes = await client.query<{ plan: string }>(
      "SELECT plan FROM workspaces WHERE id = $1",
      [existing.workspace_id],
    );
    const workspace = workspaceRes.rows[0] ?? null;
    if (!workspace) {
      await client.query("ROLLBACK");
      throw new PaymentHttpError(404, { error: "workspace_not_found" });
    }

    const periodRes = await client.query<{ id: string; included_seals: number }>(
      `SELECT id, included_seals
         FROM workspace_usage_periods
         WHERE workspace_id = $1 AND period_start <= now() AND period_end > now()
         ORDER BY period_start DESC LIMIT 1`,
      [existing.workspace_id],
    );
    const currentPeriod = periodRes.rows[0] ?? null;

    const entitlement = resolveConfirmedEntitlement({
      currentPlan: workspace.plan,
      existingIncludedSeals: currentPeriod?.included_seals ?? null,
      productCode: data.productCode,
    });

    if (entitlement.nextPlan !== workspace.plan) {
      await client.query(
        "UPDATE workspaces SET plan = $1, updated_at = now() WHERE id = $2",
        [entitlement.nextPlan, existing.workspace_id],
      );
    }

    if (currentPeriod) {
      await client.query(
        entitlement.resetUsedSeals
          ? `UPDATE workspace_usage_periods
             SET included_seals = $1, used_seals = 0, updated_at = now()
             WHERE id = $2`
          : `UPDATE workspace_usage_periods
             SET included_seals = $1, updated_at = now()
             WHERE id = $2`,
        [entitlement.includedSeals, currentPeriod.id],
      );
    } else {
      const periodId = generateId();
      const { periodStart, periodEnd } = getCurrentBillingPeriodBounds();
      await client.query(
        `INSERT INTO workspace_usage_periods (id, workspace_id, period_start, period_end, included_seals, used_seals)
         VALUES ($1, $2, $3, $4, $5, 0)`,
        [
          periodId,
          existing.workspace_id,
          periodStart.toISOString(),
          periodEnd.toISOString(),
          entitlement.includedSeals,
        ],
      );
    }

    await appendEvidenceLedgerTx(client, {
      evidenceRef,
      eventType: "payment_confirmed",
      actor: input.confirmedBy?.trim() || "admin",
      payload: {
        paymentRequestId: input.paymentRequestId,
        confirmId,
        workspaceId: existing.workspace_id,
        productCode: data.productCode,
        amountCents: data.amountCents,
        entitlement,
        ...(input.provider ? { provider: input.provider } : {}),
        ...(input.providerReference ? { providerReference: input.providerReference } : {}),
      },
    });

    await client.query("COMMIT");
    return {
      ok: true,
      confirmId,
      workspaceId: existing.workspace_id,
      productCode: data.productCode,
      evidenceRef,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function sendPaymentError(reply: FastifyReply, error: unknown): unknown {
  if (error instanceof PaymentHttpError) {
    return reply.status(error.statusCode).send(error.payload);
  }
  throw error;
}

export async function registerPaymentRoutes(server: FastifyInstance): Promise<void> {

  // ── POST /api/v1/payments/request — create payment request ────────────

  server.post<{
    Body: {
      workspaceId?: string;
      productCode?: string;
      offerCode?: string;
      paymentMethod?: string;
      paymentMetadata?: PaymentLaunchMetadata;
      iq200Packet?: VyrdxIQ200Packet;
      businessAnswerPacket?: VyrdxBusinessAnswerPacket;
    };
  }>("/api/v1/payments/request", async (request, reply) => {
    const body = request.body ?? {};
    const { workspaceId, productCode, offerCode, paymentMethod, paymentMetadata } = body;
    const paymentProvider = normalizePaymentProvider(paymentMethod);
    const businessGateResponse = evaluateBusinessMotionGate(body, "payment");
    const baseMissingFields = missingPaymentDecisionFields(body);
    if (!businessGateResponse.gate.allowed) {
      try {
        const monitorEvent = recordLaunchEvent({
          type: "gate_evaluated",
          room: "launch-revenue",
          source: "/api/v1/payments/request",
          status: "blocked",
          reason: businessGateResponse.reason,
          payload: {
            motion: "payment",
            eventRef: businessGateResponse.eventRef,
            missingFields: [...new Set([...businessGateResponse.missingFields, ...baseMissingFields])],
          },
        });
        return reply.status(403).send({
          ...paymentDecisionBlock(
            businessGateResponse.reason,
            [...businessGateResponse.missingFields, ...baseMissingFields],
            [],
            businessGateResponse,
          ),
          monitorEvent: {
            id: monitorEvent.id,
            evidenceStamp: monitorEvent.evidenceStamp,
            evidencePath: monitorEvent.evidencePath,
          },
        });
      } catch (error) {
        return reply.status(503).send({
          error: "evidence_not_written",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!workspaceId) {
      return reply.status(400).send({ error: "workspaceId_required" });
    }
    if (!productCode || !isValidProductCode(productCode)) {
      return reply.status(400).send({ error: "invalid_productCode", validCodes: Object.keys(PRODUCTS) });
    }
    if (!offerCode || !isValidLaunchOfferCode(offerCode)) {
      return reply.status(403).send(paymentDecisionBlock(
        offerCode ? "PAYMENT_OFFER_INVALID" : "PAYMENT_OFFER_REQUIRED",
        offerCode ? [] : ["offerCode"],
        offerCode ? ["offerCode"] : [],
        businessGateResponse,
      ));
    }
    if (!paymentProvider) {
      return reply.status(403).send(paymentDecisionBlock(
        paymentMethod ? "PAYMENT_PROVIDER_INVALID" : "PAYMENT_PROVIDER_REQUIRED",
        paymentMethod ? [] : ["paymentMethod"],
        paymentMethod ? ["paymentMethod"] : [],
        businessGateResponse,
      ));
    }

    const missingMetadata = missingPaymentMetadata(paymentMetadata);
    if (missingMetadata.length > 0) {
      return reply.status(403).send(paymentDecisionBlock(
        "PAYMENT_METADATA_REQUIRED",
        missingMetadata,
        [],
        businessGateResponse,
      ));
    }

    try {
      recordLaunchEvent({
        type: "gate_evaluated",
        room: "launch-revenue",
        source: "/api/v1/payments/request",
        status: "allowed",
        reason: businessGateResponse.reason,
        payload: {
          motion: "payment",
          eventRef: businessGateResponse.eventRef,
          state: businessGateResponse.state,
          paymentProvider,
        },
      });
    } catch (error) {
      return reply.status(503).send({
        error: "evidence_not_written",
        detail: error instanceof Error ? error.message : String(error),
      });
    }

    const runtimeConfig = checkRuntimeConfig("payments");
    if (!runtimeConfig.ready) {
      return reply.status(503).send(runtimeConfigFailurePayload("payments", runtimeConfig));
    }

    try {
      runtimeModeService.requirePrimaryDbMode("payment_request_create");
    } catch (error) {
      if (error instanceof runtimeModeService.RuntimeModeError) {
        const runtimeCheck = checkRuntimeConfig("payments");
        return reply.status(503).send(runtimeConfigFailurePayload("payments", runtimeCheck));
      }
      throw error;
    }

    const product = PRODUCTS[productCode as ProductCode];
    const offer = LAUNCH_OFFERS[offerCode as LaunchOfferCode];
    const amount = (offer.amountCents / 100).toFixed(2);
    const reference = generateReference();
    const paymentRequestId = generateId();
    const evidenceRef = `evd_payment_request_${paymentRequestId}`;

    const eventData = {
      productCode,
      offerCode,
      offer,
      paymentMetadata,
      paymentMethod,
      paymentProvider,
      amountCents: offer.amountCents,
      reference,
      status: "pending",
      businessGate: businessGateResponse.gate.metadata,
    };
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO billing_events (id, workspace_id, event_type, event_data, created_at)
         VALUES ($1, $2, 'payment_request', $3::jsonb, now())`,
        [paymentRequestId, workspaceId, JSON.stringify(eventData)],
      );

      await appendEvidenceLedgerTx(client, {
        evidenceRef,
        eventType: "payment_request_created",
        actor: `workspace:${workspaceId}`,
        payload: {
          paymentRequestId,
          workspaceId,
          productCode,
          offerCode,
          paymentMetadata,
          paymentMethod,
          paymentProvider,
          amountCents: offer.amountCents,
          reference,
          businessGate: businessGateResponse.gate.metadata,
        },
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    let monitorEvent;
    let paymentCreatedEvent;
    try {
      monitorEvent = recordLaunchEvent({
        type: "payment_requested",
        room: "launch-revenue",
        source: "/api/v1/payments/request",
        status: "queued",
        reason: "payment_request_created",
        payload: {
          paymentRequestId,
          workspaceId,
          productCode,
          offerCode,
          paymentMetadata,
          paymentMethod,
          paymentProvider,
          evidenceRef,
          reference,
        },
      });
      paymentCreatedEvent = recordLaunchEvent({
        type: "payment_created",
        room: "launch-revenue",
        source: "/api/v1/payments/request",
        status: "queued",
        reason: "payment_request_db_write_succeeded",
        payload: {
          paymentRequestId,
          workspaceId,
          productCode,
          offerCode,
          paymentMetadata,
          paymentMethod,
          paymentProvider,
          evidenceRef,
          reference,
        },
      });
    } catch (error) {
      return reply.status(503).send({
        error: "evidence_not_written",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    const monitorEventRef = {
      id: monitorEvent.id,
      evidenceStamp: monitorEvent.evidenceStamp,
      evidencePath: monitorEvent.evidencePath,
    };
    const paymentCreatedEventRef = {
      id: paymentCreatedEvent.id,
      evidenceStamp: paymentCreatedEvent.evidenceStamp,
      evidencePath: paymentCreatedEvent.evidencePath,
    };

    if (paymentProvider === "paypal") {
      const redirectUrl = PAYMENT_CONFIG.paypal.paypalMeUrl
        ? `${PAYMENT_CONFIG.paypal.paypalMeUrl}/${amount}`
        : null;

      return {
        ok: true,
        paymentRequestId,
        method: "paypal" as const,
        productCode,
        offerCode,
        productLabel: product.label,
        offerLabel: offer.label,
        offer,
        amountUsd: amount,
        reference,
        evidenceRef,
        monitorEvent: monitorEventRef,
        paymentCreatedEvent: paymentCreatedEventRef,
        redirectUrl,
        providerEndpoint: "/api/v1/payments/paypal/create-order",
        instructions: `Create a PayPal order for invoice ${paymentRequestId} and include reference ${reference}.`,
        contactEmail: PAYMENT_CONFIG.contactEmail,
      };
    }

    if (paymentProvider === "bitcoin") {
      return {
        ok: true,
        paymentRequestId,
        method: "bitcoin" as const,
        productCode,
        offerCode,
        productLabel: product.label,
        offerLabel: offer.label,
        offer,
        amountUsd: amount,
        reference,
        evidenceRef,
        monitorEvent: monitorEventRef,
        paymentCreatedEvent: paymentCreatedEventRef,
        providerEndpoint: `/api/v1/payments/btc/address?invoiceId=${encodeURIComponent(paymentRequestId)}`,
        instructions: {
          network: "Bitcoin",
          contactEmail: PAYMENT_CONFIG.contactEmail,
          note: `Fetch a BTC address for invoice ${paymentRequestId} before sending payment.`,
        },
      };
    }

    // Bank transfer — masked details only
    return {
      ok: true,
      paymentRequestId,
      method: "bank_transfer" as const,
      productCode,
      offerCode,
      productLabel: product.label,
      offerLabel: offer.label,
      offer,
      amountUsd: amount,
      reference,
      evidenceRef,
      monitorEvent: monitorEventRef,
      paymentCreatedEvent: paymentCreatedEventRef,
      providerEndpoint: `/api/v1/payments/bank/instructions?invoiceId=${encodeURIComponent(paymentRequestId)}`,
      instructions: {
        bankAccountName: PAYMENT_CONFIG.bank.accountName || null,
        routingNumberMasked: maskAccount(PAYMENT_CONFIG.bank.routingNumber),
        accountNumberMasked: maskAccount(PAYMENT_CONFIG.bank.accountNumber),
        contactEmail: PAYMENT_CONFIG.contactEmail,
        note: `Use reference ${reference}. Contact ${PAYMENT_CONFIG.contactEmail} for full bank details.`,
      },
    };
  });

  // ── POST /api/v1/payments/bank-details — reveal full bank details ─────
  // Only after user has created a payment request (authenticated reveal)

  server.post<{
    Body: { paymentRequestId?: string };
  }>("/api/v1/payments/bank-details", async (request, reply) => {
    const { paymentRequestId } = request.body ?? {};

    if (!paymentRequestId) {
      return reply.status(400).send({ error: "paymentRequestId_required" });
    }

    // Verify the payment request exists and is bank type
    const existing = await queryOne<{ event_data: string }>(
      "SELECT event_data::text AS event_data FROM billing_events WHERE id = $1 AND event_type = 'payment_request'",
      [paymentRequestId],
    );

    if (!existing) {
      return reply.status(404).send({ error: "payment_request_not_found" });
    }

    const data = JSON.parse(existing.event_data) as { paymentMethod?: string; paymentProvider?: PaymentProvider };
    if ((data.paymentProvider ?? normalizePaymentProvider(data.paymentMethod)) !== "bank_transfer") {
      return reply.status(400).send({ error: "not_a_bank_payment" });
    }

    return {
      ok: true,
      bankAccountLabel: PAYMENT_CONFIG.bank.accountName
        ? `${PAYMENT_CONFIG.bank.accountName.slice(0, 2)}***${PAYMENT_CONFIG.bank.accountName.slice(-2)}`
        : null,
      bankRoutingLast4: PAYMENT_CONFIG.bank.routingNumber
        ? PAYMENT_CONFIG.bank.routingNumber.replaceAll(/\D/g, "").slice(-4)
        : null,
      bankAccountLast4: PAYMENT_CONFIG.bank.accountNumber
        ? PAYMENT_CONFIG.bank.accountNumber.replaceAll(/\D/g, "").slice(-4)
        : null,
      contactEmail: PAYMENT_CONFIG.contactEmail,
    };
  });

  // ── POST /api/v1/payments/paypal/create-order — provider order ────────

  server.post<{
    Body: { invoiceId?: string };
  }>("/api/v1/payments/paypal/create-order", async (request, reply) => {
    const { invoiceId } = request.body ?? {};
    if (!invoiceId) {
      return reply.status(400).send({ error: "invoiceId_required" });
    }

    const runtimeConfig = checkRuntimeConfig("payments", "paypal");
    if (!runtimeConfig.ready) {
      return reply.status(503).send(runtimeConfigFailurePayload("payments", runtimeConfig));
    }

    try {
      const invoice = await loadPaymentRequest(invoiceId);
      if (!invoice) {
        return reply.status(404).send({ error: "payment_request_not_found", invoiceId });
      }
      const invoiceData = assertInvoiceProvider(invoice, "paypal");
      const existing = await loadProviderCreated(invoiceId, "paypal");
      if (existing) {
        const existingData = JSON.parse(existing.event_data) as { orderId?: string };
        return {
          ok: true,
          provider: "paypal" as const,
          invoiceId,
          orderId: existingData.orderId ?? null,
          providerEventId: existing.id,
          reused: true,
        };
      }

      const order = await createPaypalOrder({
        invoiceId,
        amountCents: invoiceData.amountCents,
        reference: invoiceData.reference,
        productCode: invoiceData.productCode,
        offerCode: invoiceData.offerCode,
      });
      const orderId = String(order["id"]);
      const providerEventId = await emitProviderCreatedEvent({
        invoiceId,
        workspaceId: invoice.workspace_id,
        provider: "paypal",
        eventData: {
          orderId,
          reference: invoiceData.reference,
          amountCents: invoiceData.amountCents,
          paypalStatus: order["status"] ?? null,
        },
      });

      return {
        ok: true,
        provider: "paypal" as const,
        invoiceId,
        orderId,
        providerEventId,
        order,
      };
    } catch (error) {
      return sendPaymentError(reply, error);
    }
  });

  // ── POST /api/v1/payments/paypal/capture — server-side capture ────────

  server.post<{
    Body: { invoiceId?: string; orderId?: string };
  }>("/api/v1/payments/paypal/capture", async (request, reply) => {
    const { invoiceId, orderId } = request.body ?? {};
    if (!invoiceId) return reply.status(400).send({ error: "invoiceId_required" });
    if (!orderId) return reply.status(400).send({ error: "orderId_required" });

    const runtimeConfig = checkRuntimeConfig("payments", "paypal");
    if (!runtimeConfig.ready) {
      return reply.status(503).send(runtimeConfigFailurePayload("payments", runtimeConfig));
    }

    try {
      const providerCreated = await loadProviderCreated(invoiceId, "paypal", { key: "orderId", value: orderId });
      if (!providerCreated) {
        return reply.status(409).send({
          error: "paypal_order_invoice_mismatch",
          status: "FAIL_CLOSED",
          invoiceId,
          orderId,
        });
      }

      const capture = await capturePaypalOrder(orderId);
      if (capture["status"] !== "COMPLETED") {
        return reply.status(409).send({
          error: "paypal_capture_not_completed",
          status: "FAIL_CLOSED",
          invoiceId,
          orderId,
          paypalStatus: capture["status"] ?? null,
        });
      }

      const confirmed = await confirmPaymentRequest({
        paymentRequestId: invoiceId,
        confirmedBy: "provider:paypal:capture",
        provider: "paypal",
        providerReference: orderId,
        providerPayload: capture,
      });
      return { ...confirmed, provider: "paypal" as const, invoiceId, orderId, capture };
    } catch (error) {
      return sendPaymentError(reply, error);
    }
  });

  // ── POST /api/v1/payments/paypal/webhook — verified webhook ────────────

  server.post("/api/v1/payments/paypal/webhook", async (request, reply) => {
    let signatureOk = false;
    try {
      signatureOk = await verifyPaypalWebhookSignature(request);
    } catch (error) {
      return sendPaymentError(reply, error);
    }
    if (!signatureOk) {
      return reply.status(401).send({
        error: "paypal_webhook_signature_invalid",
        status: "FAIL_CLOSED",
        provider: "paypal",
      });
    }

    const body = objectValue(request.body);
    const { invoiceId, orderId } = extractPaypalWebhookLink(body);
    if (!invoiceId) return reply.status(400).send({ error: "invoiceId_required" });
    if (!orderId) return reply.status(400).send({ error: "orderId_required" });

    const runtimeConfig = checkRuntimeConfig("payments", "paypal");
    if (!runtimeConfig.ready) {
      return reply.status(503).send(runtimeConfigFailurePayload("payments", runtimeConfig));
    }

    const providerCreated = await loadProviderCreated(invoiceId, "paypal", { key: "orderId", value: orderId });
    if (!providerCreated) {
      return reply.status(409).send({
        error: "paypal_order_invoice_mismatch",
        status: "FAIL_CLOSED",
        invoiceId,
        orderId,
      });
    }

    if (!isPaypalPaidEvent(body)) {
      return {
        ok: true,
        provider: "paypal" as const,
        invoiceId,
        orderId,
        confirmed: false,
        ignoredEventType: body["event_type"] ?? null,
      };
    }

    try {
      const confirmed = await confirmPaymentRequest({
        paymentRequestId: invoiceId,
        confirmedBy: "provider:paypal:webhook",
        provider: "paypal",
        providerReference: orderId,
        providerPayload: body,
      });
      return { ...confirmed, provider: "paypal" as const, invoiceId, orderId };
    } catch (error) {
      return sendPaymentError(reply, error);
    }
  });

  // ── GET /api/v1/payments/bank/instructions — bank provider ─────────────

  server.get<{
    Querystring: { invoiceId?: string };
  }>("/api/v1/payments/bank/instructions", async (request, reply) => {
    const invoiceId = request.query.invoiceId;
    if (!invoiceId) return reply.status(400).send({ error: "invoiceId_required" });

    const runtimeConfig = checkRuntimeConfig("payments", "bank_transfer");
    if (!runtimeConfig.ready) {
      return reply.status(503).send(runtimeConfigFailurePayload("payments", runtimeConfig));
    }

    try {
      const invoice = await loadPaymentRequest(invoiceId);
      if (!invoice) return reply.status(404).send({ error: "payment_request_not_found", invoiceId });
      const invoiceData = assertInvoiceProvider(invoice, "bank_transfer");
      const existing = await loadProviderCreated(invoiceId, "bank_transfer");
      const providerEventId = existing?.id ?? await emitProviderCreatedEvent({
        invoiceId,
        workspaceId: invoice.workspace_id,
        provider: "bank_transfer",
        eventData: {
          reference: invoiceData.reference,
          amountCents: invoiceData.amountCents,
        },
      });

      return {
        ok: true,
        provider: "bank_transfer" as const,
        invoiceId,
        providerEventId,
        bankName: PAYMENT_CONFIG.bank.bankName || PAYMENT_CONFIG.bank.accountName,
        accountName: PAYMENT_CONFIG.bank.accountName || null,
        iban: PAYMENT_CONFIG.bank.iban || null,
        account: PAYMENT_CONFIG.bank.accountNumber || null,
        swift: PAYMENT_CONFIG.bank.swift,
        reference: invoiceData.reference,
        contactEmail: PAYMENT_CONFIG.contactEmail,
      };
    } catch (error) {
      return sendPaymentError(reply, error);
    }
  });

  // ── GET /api/v1/payments/btc/address — Bitcoin provider ────────────────

  server.get<{
    Querystring: { invoiceId?: string };
  }>("/api/v1/payments/btc/address", async (request, reply) => {
    const invoiceId = request.query.invoiceId;
    if (!invoiceId) return reply.status(400).send({ error: "invoiceId_required" });

    const runtimeConfig = checkRuntimeConfig("payments", "bitcoin");
    if (!runtimeConfig.ready) {
      return reply.status(503).send(runtimeConfigFailurePayload("payments", runtimeConfig));
    }

    try {
      const invoice = await loadPaymentRequest(invoiceId);
      if (!invoice) return reply.status(404).send({ error: "payment_request_not_found", invoiceId });
      const invoiceData = assertInvoiceProvider(invoice, "bitcoin");
      const existing = await loadProviderCreated(invoiceId, "bitcoin");
      if (existing) {
        const existingData = JSON.parse(existing.event_data) as { address?: string };
        return {
          ok: true,
          provider: "bitcoin" as const,
          invoiceId,
          providerEventId: existing.id,
          address: existingData.address ?? PAYMENT_CONFIG.btc.address,
          network: "Bitcoin",
          reference: invoiceData.reference,
          reused: true,
        };
      }

      const providerEventId = await emitProviderCreatedEvent({
        invoiceId,
        workspaceId: invoice.workspace_id,
        provider: "bitcoin",
        eventData: {
          address: PAYMENT_CONFIG.btc.address,
          reference: invoiceData.reference,
          amountCents: invoiceData.amountCents,
        },
      });
      return {
        ok: true,
        provider: "bitcoin" as const,
        invoiceId,
        providerEventId,
        address: PAYMENT_CONFIG.btc.address,
        network: "Bitcoin",
        reference: invoiceData.reference,
      };
    } catch (error) {
      return sendPaymentError(reply, error);
    }
  });

  // ── POST /api/v1/payments/btc/admin-confirm — manual BTC confirmation ──

  server.post<{
    Body: { invoiceId?: string; txId?: string; confirmedBy?: string };
  }>("/api/v1/payments/btc/admin-confirm", async (request, reply) => {
    const { invoiceId, txId, confirmedBy } = request.body ?? {};
    if (!invoiceId) return reply.status(400).send({ error: "invoiceId_required" });

    const runtimeConfig = checkRuntimeConfig("payments", "bitcoin");
    if (!runtimeConfig.ready) {
      return reply.status(503).send(runtimeConfigFailurePayload("payments", runtimeConfig));
    }

    try {
      const providerCreated = await loadProviderCreated(invoiceId, "bitcoin");
      if (!providerCreated) {
        return reply.status(409).send({
          error: "bitcoin_invoice_address_missing",
          status: "FAIL_CLOSED",
          invoiceId,
          nextAction: "Create a BTC invoice address before admin confirmation.",
        });
      }
      const confirmed = await confirmPaymentRequest({
        paymentRequestId: invoiceId,
        confirmedBy: confirmedBy?.trim() || "admin:bitcoin",
        provider: "bitcoin",
        ...(txId ? { providerReference: txId } : {}),
      });
      return { ...confirmed, provider: "bitcoin" as const, invoiceId, txId: txId ?? null };
    } catch (error) {
      return sendPaymentError(reply, error);
    }
  });

  // ── POST /api/v1/payments/confirm — admin confirms payment received ───

  server.post<{
    Body: { paymentRequestId?: string; confirmedBy?: string };
  }>("/api/v1/payments/confirm", async (request, reply) => {
    const { paymentRequestId, confirmedBy } = request.body ?? {};

    if (!paymentRequestId) {
      return reply.status(400).send({ error: "paymentRequestId_required" });
    }

    const runtimeConfig = checkRuntimeConfig("payments");
    if (!runtimeConfig.ready) {
      return reply.status(503).send(runtimeConfigFailurePayload("payments", runtimeConfig));
    }

    try {
      return await confirmPaymentRequest({
        paymentRequestId,
        ...(confirmedBy ? { confirmedBy } : {}),
      });
    } catch (error) {
      return sendPaymentError(reply, error);
    }
  });

  // ── GET /api/v1/payments/history — list payment requests for workspace ──

  server.get<{
    Querystring: { workspaceId?: string };
  }>("/api/v1/payments/history", async (request, reply) => {
    const workspaceId = request.query.workspaceId;
    if (!workspaceId) {
      return reply.status(400).send({ error: "workspaceId_required" });
    }

    const rows = await query<{
      id: string; event_type: string; event_data: string; created_at: string;
    }>(
      `SELECT id, event_type, event_data::text AS event_data, created_at
       FROM billing_events
       WHERE workspace_id = $1 AND event_type IN ('payment_request', 'payment_confirmed')
       ORDER BY created_at DESC LIMIT 50`,
      [workspaceId],
    );

    const events = rows.map((r) => {
      const data = JSON.parse(r.event_data) as Record<string, unknown>;
      return {
        id: r.id,
        type: r.event_type,
        productCode: data.productCode ?? null,
        amountCents: data.amountCents ?? null,
        reference: data.reference ?? null,
        status: data.status ?? (r.event_type === "payment_confirmed" ? "confirmed" : "pending"),
        paymentMethod: data.paymentProvider ?? data.paymentMethod ?? null,
        createdAt: r.created_at,
      };
    });

    return { ok: true, events };
  });
}
