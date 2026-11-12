/**
 * Shared pure helpers for Pelecard's APIs (Isracard is the acquirer; Pelecard
 * is the gateway the terminal lives on): amounts in agorot, the order
 * reference Pelecard stores (paramX), and reading result codes. The payment
 * page mapping and the reconcile lookup build on these.
 */

export interface PelecardCredentials {
  terminalNumber: string;
  user: string;
  password: string;
}

/** Pelecard's paramX is free text of at most 19 characters. */
const PARAM_X_MAX = 19;

export function toAgorot(amountIls: number): number {
  return Math.round(amountIls * 100);
}

/**
 * The order reference Pelecard stores with the transaction, so a lookup can
 * find a payment whose answer never arrived. The first 19 hex digits of the
 * order id: stable per order and, at 76 bits, unique in practice.
 */
export function pelecardParamX(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, PARAM_X_MAX);
}

/** The fields kept on the order for support. No card number, expiry, or Shva record. */
const STORED_FIELDS = [
  "PelecardTransactionId",
  "VoucherId",
  "ShvaResult",
  "DebitApproveNumber",
  "DebitTotal",
  "DebitCurrency",
  "TotalPayments",
  "FirstPaymentTotal",
  "FixedPaymentTotal",
  "CreditType",
  "JParam",
  "CreditCardCompanyClearer",
  "CreditCardCompanyIssuer",
  "CreditCardBrand",
  "CreditCardAbroadCard",
  "AdditionalDetailsParamX",
] as const;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A Pelecard or Shva result code as three digits ("0" and 0 read as "000"), or null. */
export function normalizeCode(code: unknown): string | null {
  if (typeof code === "number" && Number.isInteger(code) && code >= 0) return String(code).padStart(3, "0");
  if (typeof code === "string" && /^\d{1,3}$/.test(code.trim())) return code.trim().padStart(3, "0");
  return null;
}

export function statusOf(body: Record<string, unknown>): string | null {
  return normalizeCode(body.StatusCode);
}

/** The response fields safe to keep on an order. */
export function pickStored(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(STORED_FIELDS.filter((key) => key in data).map((key) => [key, data[key]]));
}
