import "server-only";

import { getMorningAccessToken } from "./auth";
import { getMorningConfig } from "./config";
import { morningPaymentObject, receiptRemarks, type ReceiptPayment } from "./payment-mapping";

export interface ReceiptInput {
  description: string;
  amountIls: number;
  /** ISO YYYY-MM-DD, Israel. */
  paidOn: string;
  client: { name: string; phone: string; email: string | null };
  payment: ReceiptPayment;
}

export type ReceiptResult =
  | { ok: true; id: string; url: string | null }
  | { ok: false; error: string };

const REQUEST_TIMEOUT_MS = 30_000;

async function postDocument(token: string, body: Record<string, unknown>): Promise<Response> {
  const { apiBase } = getMorningConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${apiBase}/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A חשבונית מס קבלה for money already collected, by card on the site or by
 * hand at the field. Morning emails it to the client when there is an email.
 * Best-effort from the caller's side: a failure is logged on the order and
 * retried from the orders page, the plan is never held back.
 */
export async function createReceiptDocument(input: ReceiptInput): Promise<ReceiptResult> {
  const { documentType } = getMorningConfig();
  const remarks = receiptRemarks(input.payment);
  const body = {
    type: documentType,
    lang: "he",
    currency: "ILS",
    vatType: 0,
    description: input.description,
    client: {
      name: input.client.name,
      phone: input.client.phone,
      emails: input.client.email ? [input.client.email] : [],
      add: true,
    },
    income: [
      { description: input.description, quantity: 1, price: input.amountIls, currency: "ILS", vatType: 0 },
    ],
    payment: [morningPaymentObject(input.payment, input.amountIls, input.paidOn)],
    ...(remarks ? { remarks } : {}),
  };

  try {
    let response = await postDocument(await getMorningAccessToken(), body);
    if (response.status === 401) {
      response = await postDocument(await getMorningAccessToken(true), body);
    }
    const text = await response.text();
    if (!response.ok) {
      console.error(`[Morning] documents ${response.status}:`, text.slice(0, 500));
      return { ok: false, error: `documents ${response.status}` };
    }
    const data = JSON.parse(text) as {
      errorCode?: number;
      errorDescription?: string;
      id?: string;
      url?: { he?: string; origin?: string };
    };
    if ((data.errorCode && data.errorCode !== 0) || !data.id) {
      console.error("[Morning] documents error:", data.errorCode, data.errorDescription);
      return { ok: false, error: data.errorDescription ?? "documents error" };
    }
    return { ok: true, id: data.id, url: data.url?.he ?? data.url?.origin ?? null };
  } catch (error) {
    console.error("[Morning] documents request failed:", error);
    return { ok: false, error: "documents request failed" };
  }
}
