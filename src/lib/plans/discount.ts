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
