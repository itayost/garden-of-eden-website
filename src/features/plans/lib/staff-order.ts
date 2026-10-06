import "server-only";

import { staffSalePrice, type StaffSaleTerms } from "@/lib/plans/staff-price";
import type { PlanProduct } from "@/types/plans";

/** Who a staff sale names on its order. */
export interface StaffOrderParties {
  profileId: string | null;
  loginPhone: string;
  child: { name: string; birthdate: string | null };
  parent: { name: string; phone: string; email: string | null };
}

/**
 * A staff sale's order columns, priced by staffSalePrice (a Discount, a
 * manual Card's typed price, or a free sale, checked here for every path):
 * the amount paid, what it was worth and why when less is paid, a manual
 * Card's terms, and the people. Who may set a price is the caller's check
 * (pricingRefusal).
 */
export function staffOrderColumns(
  product: Pick<PlanProduct, "id" | "branch_id" | "price_ils">,
  sale: StaffSaleTerms,
  actorId: string,
  parties: StaffOrderParties,
) {
  const price = staffSalePrice(Number(product.price_ils), sale);
  if (!price.ok) return price;
  return {
    ok: true as const,
    paid: price.paid,
    listPrice: price.listPrice,
    columns: {
      product_id: product.id,
      branch_id: product.branch_id,
      amount_ils: price.paid,
      list_price_ils: price.listPrice,
      discount_reason: price.reason,
      discounted_by: price.listPrice !== null ? actorId : null,
      terms_sessions_total: sale.manualCard?.sessions ?? null,
      terms_duration_days: sale.manualCard?.days ?? null,
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
