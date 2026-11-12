import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";

/** Written on a newer unpaid link when an older link for the same child was paid. */
export const OLDER_LINK_PAID_NOTE = "closed: an older link for this child was paid";

type LinkOrder = { id: string; profile_id: string | null; created_at: string };

/**
 * Whether another Payment link for the same child was paid since this one
 * was sent: a newer link, or an older one paid while this one was open
 * (links A, B, C: A paid, then B must not make a second Plan). A link paid
 * before this one was sent is an earlier sale and does not count. A read
 * that fails counts as paid: the payment is then flagged for an admin rather
 * than risking a second Plan.
 */
export async function otherPaymentLinkPaidSince(db: SupabaseClient, order: LinkOrder): Promise<boolean> {
  if (!order.profile_id) return false;
  const { count, error } = (await typedFrom(db, "orders")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", order.profile_id)
    .not("payment_link_by", "is", null)
    .eq("status", "paid")
    .gte("paid_at", order.created_at)
    .neq("id", order.id)) as { count: number | null; error: { message: string } | null };
  if (error) {
    console.error(`[payment-link] order ${order.id} other-link check failed:`, error.message);
    return true;
  }
  return (count ?? 0) > 0;
}

/**
 * After an older link was paid, closes the child's newer unpaid links so the
 * parent cannot pay twice. A failure is logged; the paid order stands.
 */
export async function closeNewerPaymentLinks(db: SupabaseClient, order: LinkOrder): Promise<void> {
  if (!order.profile_id) return;
  const { error } = (await typedFrom(db, "orders")
    .update({ status: "failed", fulfillment_error: OLDER_LINK_PAID_NOTE })
    .eq("profile_id", order.profile_id)
    .not("payment_link_by", "is", null)
    .in("status", ["pending", "expired"])
    .gt("created_at", order.created_at)
    .neq("id", order.id)) as { error: { message: string } | null };
  if (error) console.error(`[payment-link] order ${order.id} closing newer links failed:`, error.message);
}
