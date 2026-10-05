/** The card page for an order; opened with a full page load (its CSP). */
export const payPath = (orderId: string) => `/join/pay/${orderId}`;

/**
 * An order still waits for the parent's card: not taken by hand (staff record
 * cash, transfer and Bit as manual) and not yet paid. An expired one may
 * still be paid.
 */
export const awaitsCard = (order: { payment_provider: string; status: string }): boolean =>
  order.payment_provider !== "manual" && (order.status === "pending" || order.status === "expired");
