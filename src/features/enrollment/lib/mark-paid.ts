import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import type { Order } from "@/types/plans";

export interface PaidReference {
  provider: Order["payment_provider"];
  transactionId: string | null;
  approvalNumber: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  installments: number;
  raw: unknown;
}

/**
 * Moves one order from pending (or expired: a checkout the cron gave up on
 * but the parent finished) to paid, in a single conditional update. The
 * caller that gets a row back owns fulfillment; anyone else lost the race.
 */
export async function markOrderPaid(
  db: SupabaseClient,
  orderId: string,
  ref: PaidReference,
): Promise<{ claimed: boolean; error: string | null }> {
  const { data, error } = (await typedFrom(db, "orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_provider: ref.provider,
      provider_transaction_id: ref.transactionId,
      approval_number: ref.approvalNumber,
      card_brand: ref.cardBrand,
      card_last4: ref.cardLast4,
      installments: ref.installments,
      provider_response: ref.raw ?? null,
    })
    .eq("id", orderId)
    .in("status", ["pending", "expired"])
    .select("id")) as { data: { id: string }[] | null; error: { code?: string; message: string } | null };
  if (error) {
    if (error.code === "23505") return { claimed: false, error: "transaction id already used" };
    return { claimed: false, error: error.message };
  }
  return { claimed: (data?.length ?? 0) > 0, error: null };
}
