"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import { fulfillOrder } from "@/features/enrollment/lib/fulfillment";
import { notifyOrderFulfilled } from "@/features/enrollment/lib/notify";
import type { MorningWebhookEvent, Order } from "@/types/plans";

export type AdminOrderRow = Order & {
  productName: string;
  agreementId: string | null;
};

type ActionResult = { success: true } | { error: string };

const ORDERS_LIMIT = 200;

export async function listOrdersAction(): Promise<AdminOrderRow[]> {
  const { error } = await verifyAdmin();
  if (error) return [];
  const db = createAdminClient();

  const { data } = (await typedFrom(db, "orders")
    .select("*, product:plan_products(name_he), agreement:enrollment_agreements(id)")
    .order("created_at", { ascending: false })
    .limit(ORDERS_LIMIT)) as {
    data:
      | (Order & { product: { name_he: string } | null; agreement: { id: string }[] | null })[]
      | null;
  };

  return (data ?? []).map(({ product, agreement, ...order }) => ({
    ...order,
    amount_ils: Number(order.amount_ils),
    productName: product?.name_he ?? "",
    agreementId: agreement?.[0]?.id ?? null,
  }));
}

/** Re-runs fulfillment for a paid order that failed; every step is idempotent. */
export async function retryFulfillmentAction(orderId: string): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(orderId)) return { error: "מזהה הזמנה לא תקין" };

  const db = createAdminClient();
  const result = await fulfillOrder(db, orderId);
  if (!result.ok) return { error: result.error };
  await notifyOrderFulfilled(db, orderId);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/plans");
  return { success: true };
}

/** Deliveries that carried no order we know: money to chase by hand. */
export async function listUnassignedWebhookEventsAction(): Promise<MorningWebhookEvent[]> {
  const { error } = await verifyAdmin();
  if (error) return [];
  const { data } = (await typedFrom(createAdminClient(), "morning_webhook_events")
    .select("*")
    .not("error", "is", null)
    .order("received_at", { ascending: false })
    .limit(50)) as { data: MorningWebhookEvent[] | null };
  return data ?? [];
}
