import { reasonSchema } from "@/lib/validations/plans-admin";

/**
 * A Discount: an Admin or Branch manager sells a Plan below its list price,
 * with a reason. The order keeps the list price and the amount paid; the
 * receipt, the agreement and any refund use the amount paid.
 */
export interface Discount {
  amountIls: number;
  reason: string;
}

/** Why this amount cannot be the discounted price of a Plan listed at listPrice, or null. */
export function discountProblem(listPrice: number, amountIls: number): string | null {
  if (!(amountIls > 0)) return "הסכום לתשלום חייב להיות גדול מ-0";
  if (Math.abs(amountIls * 100 - Math.round(amountIls * 100)) > 1e-6) return "סכום בשקלים ובאגורות בלבד";
  if (amountIls >= listPrice) return "הסכום לתשלום צריך להיות נמוך ממחיר המחירון";
  return null;
}

/** A staff form's discount: off, or the amount typed and the reason. */
export interface DiscountDraft {
  on: boolean;
  amount: string;
  reason: string;
}

export const NO_DISCOUNT: DiscountDraft = { on: false, amount: "", reason: "" };

/** The Discount to send, null at list price; problem says why the draft cannot be sent. */
export function readDiscount(draft: DiscountDraft, listPrice: number): { discount: Discount | null; problem: string | null } {
  if (!draft.on) return { discount: null, problem: null };
  const amountIls = Number(draft.amount);
  const reason = reasonSchema.safeParse(draft.reason);
  const problem =
    draft.amount.trim() === ""
      ? "נדרש הסכום לתשלום"
      : (discountProblem(listPrice, amountIls) ?? (reason.success ? null : (reason.error.issues[0]?.message ?? "נדרשת סיבה")));
  return { discount: problem || !reason.success ? null : { amountIls, reason: reason.data }, problem };
}

/**
 * An order may still be charged at the price it captured: its list price (the
 * amount itself, unless discounted) must still be the product's. A Discount
 * given by staff keeps its amount; a changed catalog price starts over.
 */
export function capturedPriceHolds(
  productPrice: number,
  order: { amountIls: number; listPriceIls: number | null },
): boolean {
  return (order.listPriceIls ?? order.amountIls) === productPrice;
}
