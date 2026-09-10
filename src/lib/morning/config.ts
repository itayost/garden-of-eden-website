import "server-only";

const HOSTS = {
  sandbox: {
    apiBase: "https://sandbox.d.greeninvoice.co.il/api/v1",
    tokenBase: "https://api.sandbox.morning.dev",
  },
  production: {
    apiBase: "https://api.greeninvoice.co.il/api/v1",
    tokenBase: "https://api.morning.co",
  },
} as const;

/** 320 = חשבונית מס/קבלה. The env var overrides for an עוסק פטור (400). */
const DEFAULT_DOCUMENT_TYPE = 320;

export interface MorningConfig {
  apiBase: string;
  tokenBase: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  documentType: number;
}

/** True once the three Morning secrets are set; the checkout refuses politely until then. */
export function isMorningConfigured(): boolean {
  return Boolean(
    process.env.MORNING_CLIENT_ID?.trim() &&
      process.env.MORNING_CLIENT_SECRET?.trim() &&
      process.env.MORNING_WEBHOOK_SECRET?.trim(),
  );
}

export function getMorningConfig(): MorningConfig {
  const env = process.env.MORNING_ENV === "production" ? "production" : "sandbox";
  const clientId = process.env.MORNING_CLIENT_ID?.trim();
  const clientSecret = process.env.MORNING_CLIENT_SECRET?.trim();
  const webhookSecret = process.env.MORNING_WEBHOOK_SECRET?.trim();
  if (!clientId || !clientSecret || !webhookSecret) {
    throw new Error("Morning environment variables are not configured");
  }
  const documentType = Number(process.env.MORNING_DOCUMENT_TYPE ?? DEFAULT_DOCUMENT_TYPE);
  return { ...HOSTS[env], clientId, clientSecret, webhookSecret, documentType };
}
