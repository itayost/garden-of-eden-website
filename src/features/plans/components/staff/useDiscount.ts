"use client";

import { useState } from "react";
import { NO_DISCOUNT, readDiscount, type Discount, type DiscountDraft } from "@/lib/plans/discount";

/**
 * A staff sheet's Discount: offered only on a product the caller manages
 * (Admin or the branch's manager). discount is what to send, null at list
 * price; problem keeps the sheet from submitting a draft that cannot go.
 */
export function useDiscount(product: { price_ils: number; managed: boolean } | null, enabled = true) {
  const [draft, setDraft] = useState<DiscountDraft>(NO_DISCOUNT);
  const offered = enabled && product !== null && product.managed;
  const read: { discount: Discount | null; problem: string | null } = offered
    ? readDiscount(draft, product.price_ils)
    : { discount: null, problem: null };
  return { offered, draft, setDraft, ...read, reset: () => setDraft(NO_DISCOUNT) };
}
