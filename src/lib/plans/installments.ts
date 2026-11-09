/** The most installments any card payment may be split into. */
export const MAX_INSTALLMENTS = 3;

/**
 * The most card installments one order may be paid in (issue #161).
 *
 * A catalog product carries its own cap (plan_products.max_installments:
 * the 20 card 3, the 10 card 2, the intro pack 1). A manual Card is one
 * placeholder product sold on typed terms, so its cap follows the sessions
 * on the order, by the same steps as the catalog cards.
 */
export function maxInstallmentsFor(
  product: { max_installments: number | null; staff_terms: boolean },
  order: { terms_sessions_total: number | null },
): number {
  const cap = product.staff_terms
    ? manualCardCap(order.terms_sessions_total ?? 0)
    : (product.max_installments ?? MAX_INSTALLMENTS);
  return Math.min(Math.max(1, Math.trunc(cap)), MAX_INSTALLMENTS);
}

function manualCardCap(sessions: number): number {
  if (sessions >= 20) return 3;
  if (sessions >= 10) return 2;
  return 1;
}
