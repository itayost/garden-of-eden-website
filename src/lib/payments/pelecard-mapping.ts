import type { CardChargeRequest } from "./provider";

/**
 * Pure request and response mapping for Pelecard's Services ReST API
 * (DebitRegularType / DebitPaymentsType, both J4). Isracard is the acquirer;
 * Pelecard is the gateway the terminal lives on. Kept free of I/O so the
 * money rules can be tested: totals in agorot, the installment split, and
 * which answers are safe to retry.
 */

export interface PelecardCredentials {
  terminalNumber: string;
  user: string;
  password: string;
}

export type PelecardDebitPath = "DebitRegularType" | "DebitPaymentsType";

/** Pelecard's paramX is free text of at most 19 characters. */
const PARAM_X_MAX = 19;
const SHOP_NUMBER = "001";
const CURRENCY_ILS = "1";

export function toAgorot(amountIls: number): number {
  return Math.round(amountIls * 100);
}

/**
 * The order reference Pelecard stores with the transaction, so TrxLookUp can
 * find a charge whose answer never arrived. The first 19 hex digits of the
 * order id: stable per order and, at 76 bits, unique in practice.
 */
export function pelecardParamX(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, PARAM_X_MAX);
}

/**
 * Pelecard requires total = first + fixed * (n - 1) (status 037), so the
 * remainder of an uneven split goes on the first payment.
 */
export function splitInstallments(totalAgorot: number, count: number): { first: number; fixed: number } {
  const fixed = Math.floor(totalAgorot / count);
  return { first: totalAgorot - fixed * (count - 1), fixed };
}

function mmyy(month: number, year: number): string {
  return `${String(month).padStart(2, "0")}${String(year % 100).padStart(2, "0")}`;
}

export function buildDebitRequest(
  request: CardChargeRequest,
  creds: PelecardCredentials,
): { path: PelecardDebitPath; body: Record<string, string> } {
  const total = toAgorot(request.amountIls);
  const base = {
    terminalNumber: creds.terminalNumber,
    user: creds.user,
    password: creds.password,
    shopNumber: SHOP_NUMBER,
    creditCard: request.card.number,
    creditCardDateMmYy: mmyy(request.card.expMonth, request.card.expYear),
    token: "",
    total: String(total),
    currency: CURRENCY_ILS,
    cvv2: request.card.cvv,
    id: request.card.holderId,
    authorizationNumber: "",
    paramX: pelecardParamX(request.orderId),
  };
  if (request.installments <= 1) return { path: "DebitRegularType", body: base };
  const { first } = splitInstallments(total, request.installments);
  return {
    path: "DebitPaymentsType",
    body: { ...base, paymentsNumber: String(request.installments), firstPayment: String(first) },
  };
}

export type PelecardOutcome =
  | { kind: "approved"; transactionId: string; approvalNumber: string | null; raw: Record<string, unknown> }
  /** The issuer refused the card. Nothing was charged; the parent may retry. */
  | { kind: "declined"; statusCode: string; message: string; providerMessage: string }
  /** Pelecard or the terminal failed. Nothing was charged; safe to retry later. */
  | { kind: "failed"; statusCode: string; message: string; providerMessage: string }
  /** The card may have been charged. The order must stay claimed until reconciled. */
  | { kind: "unknown"; reason: string };

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

const UNAVAILABLE = "שירות הסליקה אינו זמין כרגע. נסו שוב בעוד כמה דקות.";
const NOT_CONFIGURED = "הסליקה אינה זמינה כרגע. נסו שוב מאוחר יותר או כתבו לנו בוואטסאפ 052-577-9446.";

/** Codes that mean the gateway or terminal failed, from the manual's status appendix. */
const FAILED_CODES: Record<string, string> = {
  "009": UNAVAILABLE,
  "306": UNAVAILABLE,
  "500": UNAVAILABLE,
  "596": UNAVAILABLE,
  "599": UNAVAILABLE,
  "404": NOT_CONFIGURED,
  "501": NOT_CONFIGURED,
  "502": NOT_CONFIGURED,
  "503": NOT_CONFIGURED,
  "505": NOT_CONFIGURED,
  "506": NOT_CONFIGURED,
  "507": NOT_CONFIGURED,
  "508": NOT_CONFIGURED,
  "509": NOT_CONFIGURED,
  "597": NOT_CONFIGURED,
  "598": NOT_CONFIGURED,
};

const INVALID_CARD = "מספר הכרטיס לא תקין. בדקו והקלידו שוב.";
const WRONG_ID_OR_CVV = "תעודת הזהות או 3 הספרות בגב הכרטיס שגויים. בדקו ונסו שוב.";
const NO_INSTALLMENTS = "לא ניתן לחלק את התשלום בכרטיס הזה. נסו תשלום אחד או כרטיס אחר.";

const DECLINE_MESSAGES: Record<string, string> = {
  "033": INVALID_CARD,
  "039": INVALID_CARD,
  "036": "תוקף הכרטיס עבר. בדקו את התוקף או נסו כרטיס אחר.",
  "006": WRONG_ID_OR_CVV,
  "057": WRONG_ID_OR_CVV,
  "058": WRONG_ID_OR_CVV,
  "059": WRONG_ID_OR_CVV,
  "037": NO_INSTALLMENTS,
  "111": NO_INSTALLMENTS,
  "138": NO_INSTALLMENTS,
  "139": NO_INSTALLMENTS,
  "999": NO_INSTALLMENTS,
};

const PROVIDER_MESSAGE_MAX = 200;

const GENERIC_DECLINE = "העסקה לא אושרה על ידי חברת האשראי. נסו כרטיס אחר או פנו לחברת האשראי.";

/** 308 is "duplicate transaction": an earlier attempt may already have captured. */
const AMBIGUOUS_CODES = new Set(["308"]);

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

/**
 * Reads a Debit* answer. Only status 000 with a transaction id and the
 * expected total counts as paid; anything that might have captured without
 * saying so is "unknown", so the caller keeps the order claimed.
 */
export function parseDebitResponse(body: unknown, expectedTotalAgorot: number): PelecardOutcome {
  if (!isRecord(body)) return { kind: "unknown", reason: "response is not a JSON object" };
  const status = statusOf(body);
  if (!status) return { kind: "unknown", reason: "response has no status code" };

  if (status === "000") {
    const data = isRecord(body.ResultData) ? body.ResultData : {};
    const transactionId = String(data.PelecardTransactionId ?? "").trim();
    if (!transactionId) return { kind: "unknown", reason: "approved without a transaction id" };
    const debitTotal = data.DebitTotal;
    if (debitTotal !== undefined && debitTotal !== "" && Number(debitTotal) !== expectedTotalAgorot) {
      return { kind: "unknown", reason: `charged ${String(debitTotal)} agorot, expected ${expectedTotalAgorot}` };
    }
    const approval = String(data.DebitApproveNumber ?? "").trim();
    return {
      kind: "approved",
      transactionId,
      approvalNumber: approval && !/^0+$/.test(approval) ? approval : null,
      raw: pickStored(data),
    };
  }

  if (AMBIGUOUS_CODES.has(status)) return { kind: "unknown", reason: `status ${status}` };
  // Pelecard's own wording, for the logs. It describes the refusal, not the
  // card. Flattened to one line so it cannot forge a log entry.
  const providerMessage =
    typeof body.ErrorMessage === "string"
      ? body.ErrorMessage.replace(/\s+/g, " ").trim().slice(0, PROVIDER_MESSAGE_MAX)
      : "";
  const failed = FAILED_CODES[status];
  if (failed) return { kind: "failed", statusCode: status, message: failed, providerMessage };
  return {
    kind: "declined",
    statusCode: status,
    message: DECLINE_MESSAGES[status] ?? GENERIC_DECLINE,
    providerMessage,
  };
}
