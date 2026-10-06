/**
 * Nothing was paid on this order: a Plan given without charging (the only
 * order the database allows at 0). No receipt, nothing to refund, nothing
 * to authorize.
 */
export const paidNothing = (order: { amount_ils: number | string }): boolean => Number(order.amount_ils) === 0;
