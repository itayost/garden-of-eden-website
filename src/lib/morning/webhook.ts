import { createHmac, timingSafeEqual } from "crypto";
import { UUID_REGEX } from "@/lib/validations/common";

/**
 * Morning signs each webhook delivery with hex HMAC-SHA256 of the raw body
 * under the webhook secret, in the x-webhook-signature header. There is no
 * timestamp in the scheme, so replay protection comes from the delivery id
 * being stored once.
 */
export function verifyMorningSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (signatureHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signatureHeader, "utf8"), Buffer.from(expected, "utf8"));
}

/**
 * The `custom` value we sent as a string on the payment form comes back as
 * either a string or an object in webhook payloads. Whatever the shape, the
 * order id is the one uuid inside it.
 */
export function extractOrderId(custom: unknown): string | null {
  if (typeof custom === "string") return UUID_REGEX.test(custom) ? custom : null;
  if (custom && typeof custom === "object") {
    const record = custom as Record<string, unknown>;
    const preferred = record.orderId ?? record.value;
    if (typeof preferred === "string" && UUID_REGEX.test(preferred)) return preferred;
    for (const value of Object.values(record)) {
      if (typeof value === "string" && UUID_REGEX.test(value)) return value;
    }
  }
  return null;
}

export interface MorningPaymentReceived {
  id?: string;
  description?: string;
  total?: number;
  custom?: unknown;
  payer?: { name?: string; phone?: string; email?: string };
  transactions?: {
    id?: string;
    total?: number;
    gateway?: string;
    gatewayTransactionId?: string;
    paymentMethod?: { type?: string; cardNumber?: string };
  }[];
}

export interface MorningDocumentCreated {
  id?: string;
  type?: number;
  number?: string;
  custom?: unknown;
  transactionId?: string;
  files?: { downloadLinks?: { he?: string; en?: string; origin?: string } };
}
