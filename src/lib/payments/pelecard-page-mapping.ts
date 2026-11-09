import { isRecord, pelecardParamX, toAgorot } from "./pelecard-mapping";

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
  const webhookUrl = `${site}/api/webhooks/pelecard`;
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
    LogoURL: `${site}/logo-transparent.png`,
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
