// server/config/payments.ts
// Payment configuration — all values from env vars. Never hardcode secrets.

export const PAYMENT_CONFIG = {
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID ?? "",
    secret: process.env.PAYPAL_SECRET ?? "",
    env: process.env.PAYPAL_ENV ?? "",
    webhookId: process.env.PAYPAL_WEBHOOK_ID ?? "",
    webhookSecret: process.env.PAYPAL_WEBHOOK_SECRET ?? "",
    paypalMeUrl: process.env.PAYPAL_ME_URL ?? "",
    receiverEmail: process.env.PAYPAL_RECEIVER_EMAIL ?? "contact@vyrdon.com",
  },
  paypalMeUrl: process.env.PAYPAL_ME_URL ?? "",
  paypalReceiverEmail: process.env.PAYPAL_RECEIVER_EMAIL ?? "contact@vyrdon.com",
  bank: {
    bankName: process.env.BANK_NAME ?? "",
    accountName: process.env.BANK_ACCOUNT_NAME ?? "",
    iban: process.env.BANK_IBAN ?? "",
    swift: process.env.BANK_SWIFT ?? "",
    routingNumber: process.env.BANK_ROUTING_NUMBER ?? "",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER ?? "",
  },
  btc: {
    address: process.env.BTC_ADDRESS ?? "",
  },
  eth: {
    address: process.env.ETH_ADDRESS ?? "",
  },
  contactEmail: process.env.PAYMENT_INSTRUCTIONS_EMAIL ?? "contact@vyrdon.com",
} as const;

export const PRODUCTS = {
  seal: { amountCents: 100, label: "Single Certificate", plan: "free" as const, sealsAdded: 1 },
  solo: { amountCents: 4900, label: "Solo", plan: "solo" as const, sealsAdded: 200 },
  business: { amountCents: 14900, label: "Business", plan: "business" as const, sealsAdded: 1000 },
  enterprise: { amountCents: 49900, label: "Enterprise", plan: "enterprise" as const, sealsAdded: 5000 },
} as const;

export const LAUNCH_OFFERS = {
  IQ200_AUDIT: {
    amountCents: 150000,
    label: "IQ200 Audit",
    billing: "one_time" as const,
    setupCents: 150000,
    monthlyCents: 0,
  },
  VYRDX_REVENUE_PILOT: {
    amountCents: 450000,
    label: "VYRDX Revenue Pilot",
    billing: "setup_plus_monthly" as const,
    setupCents: 250000,
    monthlyCents: 200000,
  },
  VXSTATION_CONTROL_ROOM: {
    amountCents: 750000,
    label: "VXSTATION Control Room",
    billing: "setup_plus_monthly" as const,
    setupCents: 500000,
    monthlyCents: 250000,
  },
} as const;

export type ProductCode = keyof typeof PRODUCTS;
export type LaunchOfferCode = keyof typeof LAUNCH_OFFERS;
export const PAYMENT_PROVIDERS = ["paypal", "bank_transfer", "bitcoin"] as const;
export type PaymentProvider = typeof PAYMENT_PROVIDERS[number];
export type PaymentMethod = PaymentProvider | "bank" | "btc";

export function isValidProductCode(code: string): code is ProductCode {
  return code in PRODUCTS;
}

export function isValidLaunchOfferCode(code: string): code is LaunchOfferCode {
  return code in LAUNCH_OFFERS;
}

export function normalizePaymentProvider(method: string | undefined): PaymentProvider | null {
  if (method === "paypal") return "paypal";
  if (method === "bank_transfer" || method === "bank") return "bank_transfer";
  if (method === "bitcoin" || method === "btc") return "bitcoin";
  return null;
}

export function isValidPaymentMethod(method: string): method is PaymentMethod {
  return normalizePaymentProvider(method) !== null;
}
