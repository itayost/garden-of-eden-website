import { isValidUUID } from "@/lib/validations/common";
import type { CardBrand } from "./card";
import { isRecord, normalizeCode, pelecardParamX, statusOf, toAgorot } from "./pelecard-mapping";

/**
 * Pure mapping for Pelecard's payment page (Iframe/Redirect 2.0). The
 * parent types the card on Pelecard's own page, embedded in ours; this
 * module only builds the request that opens that page and reads the answer.
 * Field names and values follow the developer guide, pages 10-17.
 */

export interface PageCredentials {
  terminal: string;
  user: string;
  password: string;
}

export interface PageOrder {
  id: string;
  amountIls: number;
  /** The most installments this order may be paid in (maxInstallmentsFor). */
  maxInstallments: number;
}

export type InitResult = { ok: true; url: string } | { ok: false; reason: string };

const SHOP_NUMBER = "001";
const CURRENCY_ILS = "1";
const REASON_MAX = 200;

/**
 * The init request for one order. The page returns to our site on the top
 * window (FeedbackOnTop), so our pages never load inside Pelecard's frame,
 * and Pelecard also reports the result to our webhook server to server.
 */
export function buildInitRequest(
  order: PageOrder,
  creds: PageCredentials,
  siteUrl: string,
): Record<string, string> {
  const site = siteUrl.replace(/\/+$/, "");
  const returnUrl = `${site}/join/pay/${order.id}/return`;
  // Pelecard's result JSON carries no UserKey, so the callback learns the order from its path.
  const webhookUrl = `${site}/api/webhooks/pelecard/${order.id}`;
  return {
    terminal: creds.terminal,
    user: creds.user,
    password: creds.password,
    ShopNo: SHOP_NUMBER,
    ActionType: "J4",
    Currency: CURRENCY_ILS,
    Total: String(toAgorot(order.amountIls)),
    UserKey: order.id,
    ParamX: pelecardParamX(order.id),
    GoodURL: returnUrl,
    ErrorURL: returnUrl,
    FeedbackOnTop: "True",
    FeedbackDataTransferMethod: "GET",
    ServerSideGoodFeedbackURL: webhookUrl,
    ServerSideErrorFeedbackURL: webhookUrl,
    MaxPayments: String(order.maxInstallments),
    MinPayments: "1",
    FirstPayment: "auto",
    // Guide page 14: a value above MaxPayments keeps every split a regular
    // installment deal, never credit.
    MinPaymentsForCredit: String(order.maxInstallments + 1),
    Language: "HE",
    CustomerIdField: "must",
    Cvv2Field: "must",
    CardHolderName: "hide",
    EmailField: "hide",
    TelField: "hide",
    CssURL: `${site}/pelecard/payment-page.css`,
    // No LogoURL: Pelecard's page left our logo's 150x59 box empty on the
    // first live page (2026-11-09), and its own logo is the reassuring one.
  };
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, REASON_MAX);
}

/**
 * Reads init's answer. Pelecard sends JSON with a text/html content type, so
 * the body is parsed as text. Only ErrCode 0 with a Pelecard https URL opens
 * a page; anything else is a reason for the logs.
 */
export function parseInitResponse(text: string): InitResult {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, reason: "init answer is not JSON" };
  }
  if (!isRecord(body)) return { ok: false, reason: "init answer is not a JSON object" };

  const error = isRecord(body.Error) ? body.Error : {};
  const code = Number(error.ErrCode);
  if (!Number.isFinite(code) || code !== 0) {
    const message = typeof error.ErrMsg === "string" ? oneLine(error.ErrMsg) : "";
    return { ok: false, reason: `${Number.isFinite(code) ? code : "no code"}: ${message}`.trim() };
  }
  const url = typeof body.URL === "string" ? body.URL.trim() : "";
  if (!url) return { ok: false, reason: "init answered without a page URL" };
  if (!isPelecardPageUrl(url)) return { ok: false, reason: "init answered with a URL outside pelecard.biz" };
  return { ok: true, url };
}

/**
 * How long a Pelecard page opened for an order is reused on reload. Short,
 * so a reused page is still well inside Pelecard's own time limit (status
 * 301), and long enough that reloading the card page opens nothing new.
 */
export const PAGE_REUSE_MS = 5 * 60 * 1000;

/**
 * How long the card page says "being checked" instead of opening a new
 * Pelecard page, after a result Pelecard could not confirm yet. Keeps a
 * parent who may have paid from paying again while the callback or an admin
 * settles it.
 */
export const CHECKING_MS = 15 * 60 * 1000;

export interface CachedPage {
  url: string;
  openedAt: number;
}

/**
 * The page to show again instead of opening a new one: a remembered
 * Pelecard URL opened within the reuse window. The return route forgets the
 * page once Pelecard ends it (a decline), so the next load opens a new one.
 */
export function reusablePage(cached: unknown, now: number): string | null {
  if (!isRecord(cached)) return null;
  const { url, openedAt } = cached;
  if (typeof url !== "string" || !isPelecardPageUrl(url)) return null;
  if (typeof openedAt !== "number" || !Number.isFinite(openedAt)) return null;
  const age = now - openedAt;
  return age >= 0 && age < PAGE_REUSE_MS ? url : null;
}

/** An https URL on pelecard.biz or one of its subdomains. */
export function isPelecardPageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return parsed.hostname === "pelecard.biz" || parsed.hostname.endsWith(".pelecard.biz");
}

const INVALID_CARD = "מספר הכרטיס לא תקין. בדקו והקלידו שוב.";
const WRONG_ID_OR_CVV = "תעודת הזהות או 3 הספרות בגב הכרטיס שגויים. בדקו ונסו שוב.";
const NO_INSTALLMENTS = "לא ניתן לחלק את התשלום בכרטיס הזה. נסו תשלום אחד או כרטיס אחר.";
const GENERIC_DECLINE = "העסקה לא אושרה על ידי חברת האשראי. נסו כרטיס אחר או פנו לחברת האשראי.";

/** Status codes from the guide's appendix, pages 41-44. */
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
  "301": "עבר הזמן שמוקצב לדף התשלום. נסו שוב.",
  "555": "התשלום בוטל. אפשר לנסות שוב.",
};

/** What the card page tells the parent when Pelecard returns a failure code. */
export function declineMessage(code: string | null): string {
  return (code && DECLINE_MESSAGES[code]) || GENERIC_DECLINE;
}

/** One finished payment page transaction, as GetTransaction reports it. */
export interface PageTransaction {
  /** Pelecard's id for the payment page session (GetTransaction's key). */
  transactionId: string;
  /** Pelecard's numeric transaction id, the one reconcile and the Debit path store. */
  pelecardId: string | null;
  shvaResult: string | null;
  totalAgorot: number | null;
  currency: string | null;
  paramX: string;
  confirmationKey: string | null;
  approvalNumber: string | null;
  last4: string | null;
  brand: CardBrand;
  installments: number;
  /** Safe to keep on the order: no card number, holder details, Shva record or key. */
  raw: Record<string, unknown>;
}

export type PageValidation = "valid" | "invalid" | "error";

export type PageVerdict =
  | { kind: "paid" }
  | { kind: "needs_validation" }
  | { kind: "not_paid"; code: string }
  /** Another order's transaction: it says nothing about this one. */
  | { kind: "not_ours" }
  /** No Shva result yet: nothing shows that money moved. */
  | { kind: "unfinished" }
  | { kind: "unknown"; reason: string };

const PAGE_STORED_FIELDS = [
  "TransactionId",
  "TransactionPelecardId",
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

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

/** Reads GetTransaction's answer. Fails unless it is status 000 with a transaction. */
export function parsePageTransaction(body: unknown): { ok: true; tx: PageTransaction } | { ok: false; reason: string } {
  if (!isRecord(body)) return { ok: false, reason: "GetTransaction answer is not a JSON object" };
  const status = statusOf(body);
  if (status !== "000") {
    const message = typeof body.ErrorMessage === "string" ? oneLine(body.ErrorMessage) : "";
    return { ok: false, reason: `GetTransaction status ${status ?? "missing"} ${message}`.trim() };
  }
  // The Iframe guide prints ResultData as an object, the Services guide as a list of one.
  const listed = Array.isArray(body.ResultData) && body.ResultData.length === 1 ? body.ResultData[0] : body.ResultData;
  const data: unknown = listed;
  if (!isRecord(data)) return { ok: false, reason: "GetTransaction answered without ResultData" };
  const transactionId = text(data.TransactionId);
  if (!transactionId) return { ok: false, reason: "GetTransaction answered without a TransactionId" };

  const total = Number(text(data.DebitTotal));
  const approval = text(data.DebitApproveNumber);
  const masked = text(data.CreditCardNumber).match(/(\d{4})$/);
  const payments = Number(text(data.TotalPayments));
  return {
    ok: true,
    tx: {
      transactionId,
      pelecardId: text(data.TransactionPelecardId) || null,
      shvaResult: normalizeCode(data.ShvaResult),
      totalAgorot: text(data.DebitTotal) !== "" && Number.isInteger(total) ? total : null,
      currency: text(data.DebitCurrency) || null,
      paramX: text(data.AdditionalDetailsParamX),
      confirmationKey: text(data.ConfirmationKey) || null,
      approvalNumber: approval && !/^0+$/.test(approval) ? approval : null,
      last4: masked ? masked[1] : null,
      brand: pageCardBrand(data.CreditCardBrand, data.CreditCardCompanyIssuer),
      installments: Number.isInteger(payments) && payments > 1 ? payments : 1,
      raw: Object.fromEntries(PAGE_STORED_FIELDS.filter((key) => key in data).map((key) => [key, data[key]])),
    },
  };
}

/** ValidateByUniqueKey answers 1 (the transaction is ours) or 0. */
export function parseValidateResponse(body: string): PageValidation {
  const value = body.trim().replace(/^"(.*)"$/, "$1").trim();
  if (value === "1") return "valid";
  if (value === "0") return "invalid";
  return "error";
}

/**
 * Our card brand from Pelecard's CreditCardBrand (0 private label,
 * 1 Mastercard, 2 Visa, 3 Maestro, 5 Isracard) and CreditCardCompanyIssuer
 * (1 Isracard, 2 Visa CAL, 3 Diners, 4 Amex, 5 JCB, 6 Leumi Card).
 */
export function pageCardBrand(brand: unknown, issuer: unknown): CardBrand {
  const b = text(brand);
  const i = text(issuer);
  if (i === "4") return "amex";
  if (i === "3") return "diners";
  if (b === "2") return "visa";
  if (b === "1" || b === "3") return "mastercard";
  if (b === "5" || (b === "0" && i === "1")) return "isracard";
  return "unknown";
}

/**
 * Whether a payment page transaction paid this order. A transaction carrying
 * another order's paramX is not ours and changes nothing here; one with no
 * paramX echoed is bound to the order by ValidateByUniqueKey alone (its
 * UniqueKey is the order id). A readable non-000 result is a decline. A
 * clean approval still needs ValidateByUniqueKey, and anything else about
 * our transaction that does not match exactly is unknown: money may have
 * moved, so a person decides.
 */
export function judgePagePayment(
  tx: PageTransaction,
  order: { id: string; amountIls: number },
  validation: PageValidation | "not_checked",
): PageVerdict {
  if (tx.paramX && tx.paramX !== pelecardParamX(order.id)) return { kind: "not_ours" };
  if (tx.shvaResult === null) return { kind: "unfinished" };
  if (tx.shvaResult !== "000") return { kind: "not_paid", code: tx.shvaResult };
  const expected = toAgorot(order.amountIls);
  if (tx.totalAgorot !== expected) {
    return { kind: "unknown", reason: `charged ${tx.totalAgorot ?? "unknown"} agorot, expected ${expected}` };
  }
  if (tx.currency !== CURRENCY_ILS) return { kind: "unknown", reason: `currency ${tx.currency ?? "missing"}` };
  if (validation === "not_checked") return { kind: "needs_validation" };
  if (validation === "valid") return { kind: "paid" };
  return { kind: "unknown", reason: `ValidateByUniqueKey ${validation}` };
}

type Fields = Record<string, unknown>;

function lowerKeys(record: Record<string, unknown>): Fields {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key.toLowerCase(), value]));
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Raw JSON, form fields, JSON inside one of the form fields, or URL-encoded
 * JSON sent without a field name (it parses as a key with no value).
 */
function feedbackRecord(input: string | URLSearchParams): Record<string, unknown> {
  const json = typeof input === "string" ? parseJsonObject(input) : null;
  if (json) return json;
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  const entries = [...params.entries()];
  const wrapped = entries
    .map(([key, value]) => parseJsonObject(value) ?? (value === "" ? parseJsonObject(key) : null))
    .find((found): found is Record<string, unknown> => found !== null);
  const fields = Object.fromEntries(entries.filter(([, value]) => value !== ""));
  return wrapped ? { ...fields, ...wrapped } : fields;
}

/** The callback or return fields as one flat, lowercased record. */
function feedbackFields(input: string | URLSearchParams): Fields {
  const top = lowerKeys(feedbackRecord(input));
  const nested = isRecord(top.resultdata) ? lowerKeys(top.resultdata) : {};
  return { ...nested, ...top };
}

/**
 * The only things read from a return URL or a callback body: which order,
 * which Pelecard transaction, and the status Pelecard claims. All of it is
 * a hint; the payment is confirmed with Pelecard before anything changes.
 */
export interface FeedbackIds {
  orderId: string | null;
  transactionId: string | null;
  statusCode: string | null;
}

export function feedbackIds(input: string | URLSearchParams): FeedbackIds {
  const fields = feedbackFields(input);
  const orderId = text(fields.userkey);
  const transactionId = text(fields.pelecardtransactionid) || text(fields.transactionid);
  return {
    orderId: isValidUUID(orderId) ? orderId : null,
    transactionId: transactionId || null,
    statusCode: normalizeCode(fields.pelecardstatuscode ?? fields.shvaresult ?? fields.statuscode),
  };
}

/**
 * The ids for a return or callback whose URL path names the order (Pelecard's
 * result JSON has no UserKey). A UserKey that names another order means the
 * request is not about this one. The path adds no trust: the payment is
 * still bound to the order by paramX and ValidateByUniqueKey.
 */
export function callbackIds(pathOrderId: string, input: string | URLSearchParams): FeedbackIds | null {
  if (!isValidUUID(pathOrderId)) return null;
  const ids = feedbackIds(input);
  if (ids.orderId && ids.orderId !== pathOrderId) return null;
  return { ...ids, orderId: pathOrderId };
}
