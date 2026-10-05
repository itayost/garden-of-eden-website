import "server-only";

import { discountProblem, type Discount } from "@/lib/plans/discount";
import { manualCardProblem, type ManualCardTerms } from "@/lib/plans/manual-card";
import type { PlanProduct } from "@/types/plans";

/** Who a staff sale names on its order. */
export interface StaffOrderParties {
  profileId: string | null;
  loginPhone: string;
  child: { name: string; birthdate: string | null };
  parent: { name: string; phone: string; email: string | null };
}

/**
 * A staff sale's price and the order columns every staff path writes: the
 * amount paid (a Discount below list price, or a manual Card's typed price,
 * both checked here for every path), the Discount's list price, reason and
 * giver, a manual Card's terms, and the people. Who may give either is the
 * caller's check (pricingRefusal).
 */
export function staffOrderColumns(
  product: Pick<PlanProduct, "id" | "branch_id" | "price_ils" | "staff_terms">,
  sale: { discount: Discount | null; manualCard: ManualCardTerms | null },
  actorId: string,
  parties: StaffOrderParties,
) {
  const { discount, manualCard } = sale;
  const listPrice = Number(product.price_ils);
  // A manual Card is sold only on its own placeholder product, and only on typed terms.
  if (Boolean(manualCard) !== (product.staff_terms === true)) return { ok: false as const, problem: "מסלול לא תקין" };
  if (manualCard && discount) return { ok: false as const, problem: "בכרטיסייה ידנית קובעים את המחיר עצמו, בלי הנחה" };
  const problem = manualCard
    ? manualCardProblem(manualCard)
    : discount
      ? discountProblem(listPrice, discount.amountIls)
      : null;
  if (problem) return { ok: false as const, problem };
  const paid = manualCard?.priceIls ?? discount?.amountIls ?? listPrice;
  return {
    ok: true as const,
    paid,
    listPrice,
    columns: {
      product_id: product.id,
      branch_id: product.branch_id,
      amount_ils: paid,
      list_price_ils: discount ? listPrice : null,
      discount_reason: discount?.reason ?? null,
      discounted_by: discount ? actorId : null,
      terms_sessions_total: manualCard?.sessions ?? null,
      terms_duration_days: manualCard?.days ?? null,
      parent_name: parties.parent.name,
      payer_phone: parties.parent.phone,
      login_phone: parties.loginPhone,
      child_name: parties.child.name,
      child_birthdate: parties.child.birthdate,
      email: parties.parent.email,
      profile_id: parties.profileId,
    },
  };
}
