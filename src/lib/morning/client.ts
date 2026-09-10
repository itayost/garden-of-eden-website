import "server-only";

import { getMorningAccessToken } from "./auth";
import { getMorningConfig } from "./config";

export interface PaymentFormInput {
  /** Our order id; echoed back as `custom`. */
  orderId: string;
  description: string;
  amountIls: number;
  client: {
    name: string;
    mobile: string;
    email: string | null;
  };
  successUrl: string;
  failureUrl: string;
  notifyUrl: string;
}

type PaymentFormResult = { url: string } | { error: string };

const REQUEST_TIMEOUT_MS = 30_000;

async function postPaymentForm(
  token: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const { apiBase } = getMorningConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${apiBase}/payments/form`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Creates a hosted payment page. Morning creates the document itself when the
 * customer pays and emails it to the client emails. One retry on a 401 with a
 * fresh token, none on other 4xx: those are our bug, not transient.
 */
export async function createPaymentForm(input: PaymentFormInput): Promise<PaymentFormResult> {
  const { documentType } = getMorningConfig();
  const body = {
    description: input.description,
    type: documentType,
    lang: "he",
    currency: "ILS",
    vatType: 0,
    amount: input.amountIls,
    maxPayments: 1,
    client: {
      name: input.client.name,
      mobile: input.client.mobile,
      emails: input.client.email ? [input.client.email] : [],
      add: true,
    },
    income: [
      {
        description: input.description,
        quantity: 1,
        price: input.amountIls,
        currency: "ILS",
        vatType: 0,
      },
    ],
    successUrl: input.successUrl,
    failureUrl: input.failureUrl,
    notifyUrl: input.notifyUrl,
    custom: input.orderId,
  };

  try {
    let response = await postPaymentForm(await getMorningAccessToken(), body);
    if (response.status === 401) {
      response = await postPaymentForm(await getMorningAccessToken(true), body);
    }

    const text = await response.text();
    if (!response.ok) {
      console.error(`[Morning] payments/form ${response.status}:`, text.slice(0, 500));
      return { error: "שגיאה ביצירת עמוד התשלום" };
    }

    const data = JSON.parse(text) as {
      errorCode?: number;
      errorDescription?: string;
      url?: string;
    };
    if (data.errorCode && data.errorCode !== 0) {
      console.error("[Morning] payments/form error:", data.errorCode, data.errorDescription);
      return { error: "שגיאה ביצירת עמוד התשלום" };
    }
    if (!data.url) return { error: "שגיאה ביצירת עמוד התשלום" };
    return { url: data.url };
  } catch (error) {
    console.error("[Morning] payments/form request failed:", error);
    return { error: "שגיאה ביצירת עמוד התשלום" };
  }
}
