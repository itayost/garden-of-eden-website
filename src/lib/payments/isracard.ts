import "server-only";

import type { CardChargeRequest, CardChargeResult } from "./provider";

/**
 * Isracard adapter. The request and response shapes wait on Isracard's API
 * documentation, which they send after reviewing the site. Until the three
 * settings exist the page renders and validates, and a submit is refused
 * here with the card details discarded.
 */
export function isIsracardConfigured(): boolean {
  return Boolean(
    process.env.ISRACARD_API_URL?.trim() &&
      process.env.ISRACARD_TERMINAL_ID?.trim() &&
      process.env.ISRACARD_API_KEY?.trim(),
  );
}

export async function chargeCard(request: CardChargeRequest): Promise<CardChargeResult> {
  void request;
  if (!isIsracardConfigured()) {
    return {
      ok: false,
      code: "not_configured",
      message: "התשלום באתר ייפתח בקרוב. בינתיים אפשר להשלים את ההרשמה בוואטסאפ 052-577-9446.",
    };
  }
  // The transport is written against Isracard's documentation when it arrives.
  return { ok: false, code: "error", message: "הסליקה אינה זמינה כרגע. נסו שוב מאוחר יותר." };
}
