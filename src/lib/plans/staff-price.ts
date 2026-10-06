import { discountProblem, type Discount } from "./discount";
import { manualCardProblem, type ManualCardTerms } from "./manual-card";

/** How a staff sale is priced: at most one of a Discount, a manual Card's typed price, and a free sale's reason. */
export interface StaffSaleTerms {
  discount: Discount | null;
  manualCard: ManualCardTerms | null;
  /** A Plan given without charging (owner, 2026-10-06): why. */
  freeReason: string | null;
}

export type StaffSalePrice =
  | {
      ok: true;
      /** What is paid: the receipt, the agreement and any refund use it. */
      paid: number;
      /** What it was worth, kept when less is paid (a Discount, a free sale); null otherwise. */
      listPrice: number | null;
      reason: string | null;
    }
  | { ok: false; problem: string };

/**
 * The price of a staff sale. A Discount sells a catalog Plan below its list
 * price; a manual Card is sold at the price typed; a free sale charges
 * nothing and keeps what the Plan was worth and why. A Discount combines
 * with neither of the others.
 */
export function staffSalePrice(catalogPrice: number, terms: StaffSaleTerms): StaffSalePrice {
  const { discount, manualCard, freeReason } = terms;
  if (discount && (manualCard || freeReason)) {
    return { ok: false, problem: "הנחה רק על מסלול מהמחירון שמשולם" };
  }
  const problem = manualCard ? manualCardProblem(manualCard) : discount ? discountProblem(catalogPrice, discount.amountIls) : null;
  if (problem) return { ok: false, problem };
  const worth = manualCard?.priceIls ?? catalogPrice;
  if (freeReason) return { ok: true, paid: 0, listPrice: worth, reason: freeReason };
  if (discount) return { ok: true, paid: discount.amountIls, listPrice: catalogPrice, reason: discount.reason };
  return { ok: true, paid: worth, listPrice: null, reason: null };
}
