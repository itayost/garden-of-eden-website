import type { Order } from "@/types/plans";

/**
 * Who a receipt is made out to: the player (owner, 2026-10-07). Staff often
 * do not know the parent's name and the order then holds the placeholder
 * "הורה"; the payer's phone and email still reach the parent.
 */
export function receiptClient(order: Pick<Order, "child_name" | "parent_name" | "payer_phone" | "email">): {
  name: string;
  phone: string;
  email: string | null;
} {
  return { name: order.child_name.trim(), phone: order.payer_phone, email: order.email };
}
