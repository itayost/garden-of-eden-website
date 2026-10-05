/** The card page for an order; opened with a full page load (its CSP). */
export const payPath = (orderId: string) => `/join/pay/${orderId}`;

/**
 * A Payment link still waits for the parent's card: staff sent it
 * (payment_link_by) and it is not yet paid. An expired one may still be paid.
 */
export const awaitsCard = (order: { payment_link_by: string | null; status: string }): boolean =>
  order.payment_link_by !== null && (order.status === "pending" || order.status === "expired");
