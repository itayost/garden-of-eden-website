import type { PlanProduct } from "@/types/plans";

/** The intro pack is for new players: one paid order per login phone, ever. */
export function isIntroPackEligible(
  product: Pick<PlanProduct, "once_per_trainee">,
  priorPaidIntroOrders: number,
): boolean {
  if (!product.once_per_trainee) return true;
  return priorPaidIntroOrders === 0;
}
