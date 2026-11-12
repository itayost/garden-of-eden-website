import "server-only";

import { pelecardParamX, toAgorot, type PelecardCredentials } from "./pelecard-mapping";
import { lookupWindow, parseCompleteTransData, parseTrxLookUp, type LookupOutcome } from "./pelecard-lookup";
import {
  buildInitRequest,
  parseInitResponse,
  parsePageTransaction,
  parseValidateResponse,
  type InitResult,
  type PageOrder,
  type PageTransaction,
  type PageValidation,
} from "./pelecard-page-mapping";

/**
 * Pelecard adapter for the academy's website terminal (Isracard settles).
 * The parent pays on Pelecard's own payment page (PaymentGW), framed in the
 * card page: this module opens that page, asks what happened on it, and
 * looks up a charge for the admin check (Services API). No card data ever
 * passes through here. Nothing here logs a request or response body.
 */

const DEFAULT_API_URL = "https://gateway21.pelecard.biz";
const REQUEST_TIMEOUT_MS = 30_000;

function credentials(): PelecardCredentials | null {
  const terminalNumber = process.env.PELECARD_TERMINAL?.trim();
  const user = process.env.PELECARD_USER?.trim();
  const password = process.env.PELECARD_PASSWORD?.trim();
  if (!terminalNumber || !user || !password) return null;
  return { terminalNumber, user, password };
}

export function isPelecardConfigured(): boolean {
  return credentials() !== null;
}

function apiUrl(): string {
  return (process.env.PELECARD_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, "");
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.edengarden.co.il";
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message || error.name : "request failed";
}

/** POSTs JSON to Pelecard's payment page API and returns the body as text (it answers JSON as text/html). */
async function postPaymentGW(path: string, body: Record<string, string>): Promise<string> {
  const response = await fetch(`${apiUrl()}/PaymentGW/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

/**
 * Opens a Pelecard payment page for one order and returns its URL. No card
 * data is involved: the parent types the card on that page. Never throws.
 */
export async function openPelecardPage(order: PageOrder): Promise<InitResult> {
  const creds = credentials();
  if (!creds) return { ok: false, reason: "not configured" };
  try {
    const request = buildInitRequest(
      order,
      { terminal: creds.terminalNumber, user: creds.user, password: creds.password },
      siteUrl(),
    );
    return parseInitResponse(await postPaymentGW("init", request));
  } catch (error) {
    return { ok: false, reason: `init failed: ${errorText(error)}` };
  }
}

/** Asks Pelecard what happened on a payment page. Never throws. */
export async function getPageTransaction(
  transactionId: string,
): Promise<{ ok: true; tx: PageTransaction } | { ok: false; reason: string }> {
  const creds = credentials();
  if (!creds) return { ok: false, reason: "not configured" };
  try {
    const text = await postPaymentGW("GetTransaction", {
      terminal: creds.terminalNumber,
      user: creds.user,
      password: creds.password,
      TransactionId: transactionId,
    });
    return parsePageTransaction(JSON.parse(text));
  } catch (error) {
    return { ok: false, reason: `GetTransaction failed: ${errorText(error)}` };
  }
}

/** Confirms a transaction belongs to this order and amount (ValidateByUniqueKey). Never throws. */
export async function validatePagePayment(
  confirmationKey: string,
  orderId: string,
  totalAgorot: number,
): Promise<PageValidation> {
  try {
    const text = await postPaymentGW("ValidateByUniqueKey", {
      ConfirmationKey: confirmationKey,
      UniqueKey: orderId,
      TotalX100: String(totalAgorot),
    });
    return parseValidateResponse(text);
  } catch {
    return "error";
  }
}

async function postService(path: string, body: Record<string, string>): Promise<unknown> {
  const response = await fetch(`${apiUrl()}/services/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Asks Pelecard whether an order stuck in charging was captured. First the
 * terminal's transactions from an hour before the claim until now, matched
 * on paramX and amount; when that finds nothing, TrxLookUp by paramX as a
 * second opinion, since it also lists charges not yet transmitted to Shva.
 * "not_found" only when both agree. Never throws; a failed call is "error",
 * so the caller cannot mistake it for "no charge".
 */
export async function lookupCharge(
  orderId: string,
  amountIls: number,
  chargingSince: Date,
  now: Date = new Date(),
): Promise<LookupOutcome> {
  const creds = credentials();
  if (!creds) return { kind: "error", reason: "Pelecard is not configured" };
  const paramX = pelecardParamX(orderId);
  try {
    const listed = parseCompleteTransData(
      await postService("GetCompleteTransData", { ...creds, ...lookupWindow(chargingSince, now) }),
      paramX,
      toAgorot(amountIls),
    );
    if (listed.kind !== "not_found") return listed;

    const pending = parseTrxLookUp(
      await postService("TrxLookUp", { ...creds, shopNumber: "001", paramX }),
      paramX,
    );
    if (pending === "none") return { kind: "not_found" };
    return {
      kind: "error",
      reason: pending === "charged" ? "TrxLookUp shows a charge for this order; check it in Pelecard" : "TrxLookUp failed",
    };
  } catch (error) {
    return { kind: "error", reason: error instanceof Error ? error.message || error.name : "request failed" };
  }
}
