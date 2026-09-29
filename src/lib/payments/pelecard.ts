import "server-only";

import type { CardChargeRequest, CardChargeResult } from "./provider";
import {
  buildDebitRequest,
  parseDebitResponse,
  pelecardParamX,
  toAgorot,
  type PelecardCredentials,
} from "./pelecard-mapping";
import { lookupWindow, parseCompleteTransData, parseTrxLookUp, type LookupOutcome } from "./pelecard-lookup";

/**
 * Pelecard adapter: the site's card page charges through Pelecard's Services
 * API on the academy's website terminal, and Isracard settles. Until the
 * terminal settings exist the page renders and validates, and a submit is
 * refused here with the card details discarded.
 *
 * Card data is only in the request body sent to Pelecard. Nothing here logs a
 * body or puts one in an error message.
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

/**
 * Charges the card once. Returns a decline or a failure when nothing was
 * charged, and throws when the outcome is unknown (timeout, network error, an
 * unreadable or ambiguous answer): the caller then keeps the order claimed
 * for an admin to reconcile rather than let the parent retry.
 */
export async function chargeCard(request: CardChargeRequest): Promise<CardChargeResult> {
  const creds = credentials();
  if (!creds) {
    return {
      ok: false,
      code: "not_configured",
      message: "התשלום באתר ייפתח בקרוב. בינתיים אפשר להשלים את ההרשמה בוואטסאפ 052-577-9446.",
    };
  }

  const { path, body } = buildDebitRequest(request, creds);
  let json: unknown;
  try {
    json = await postService(path, body);
  } catch (error) {
    throw new Error(`Pelecard ${path} failed: ${error instanceof Error ? error.message || error.name : "request error"}`);
  }

  const outcome = parseDebitResponse(json, toAgorot(request.amountIls));
  switch (outcome.kind) {
    case "approved":
      return { ok: true, transactionId: outcome.transactionId, approvalNumber: outcome.approvalNumber, raw: outcome.raw };
    case "declined":
      return { ok: false, code: "declined", message: outcome.message };
    case "failed":
      console.error(`[pelecard] order ${request.orderId} ${path} failed with status ${outcome.statusCode}`);
      return { ok: false, code: "error", message: outcome.message };
    case "unknown":
      throw new Error(`Pelecard ${path} outcome unknown: ${outcome.reason}`);
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
