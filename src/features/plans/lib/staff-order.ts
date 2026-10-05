import "server-only";

import { discountProblem, type Discount } from "@/lib/plans/discount";
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
 * amount paid (a Discount below list price, checked here for every path),
 * the list price, reason and giver of a Discount, and the people. Who may
 * give a Discount is the caller's check (discountRefusal).
 */
export function staffOrderColumns(
  product: Pick<PlanProduct, "id" | "branch_id" | "price_ils">,
  discount: Discount | null,
  actorId: string,
  parties: StaffOrderParties,
) {
  const listPrice = Number(product.price_ils);
  const problem = discount ? discountProblem(listPrice, discount.amountIls) : null;
  if (problem) return { ok: false as const, problem };
  const paid = discount?.amountIls ?? listPrice;
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
