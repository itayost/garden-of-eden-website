"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import { fulfillOrder } from "@/features/enrollment/lib/fulfillment";
import { notifyOrderFulfilled } from "@/features/enrollment/lib/notify";
import { issueOrderInvoice } from "@/features/enrollment/lib/invoice";
import type { MorningWebhookEvent, Order } from "@/types/plans";

export type AdminOrderRow = Order & {
  productName: string;
  agreementId: string | null;
  receivedByName: string | null;
};

type ActionResult = { success: true } | { error: string };

const ORDERS_LIMIT = 200;

export async function listOrdersAction(): Promise<AdminOrderRow[]> {
  const { error } = await verifyAdmin();
  if (error) return [];
  const db = createAdminClient();

  const { data } = (await typedFrom(db, "orders")
    .select("*, product:plan_products(name_he), agreement:enrollment_agreements(id), receiver:profiles!orders_received_by_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(ORDERS_LIMIT)) as {
    data:
      | (Order & {
          product: { name_he: string } | null;
          agreement: { id: string }[] | null;
          receiver: { full_name: string | null } | null;
        })[]
      | null;
  };

  return (data ?? []).map(({ product, agreement, receiver, ...order }) => ({
    ...order,
    amount_ils: Number(order.amount_ils),
    productName: product?.name_he ?? "",
    agreementId: agreement?.[0]?.id ?? null,
    receivedByName: receiver?.full_name ?? null,
  }));
}

/** Re-runs fulfillment for a paid order that failed; every step is idempotent. */
export async function retryFulfillmentAction(orderId: string): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(orderId)) return { error: "מזהה הזמנה לא תקין" };

  const db = createAdminClient();
  const { data: before } = (await typedFrom(db, "orders")
    .select("fulfilled_at, payment_method")
    .eq("id", orderId)
    .maybeSingle()) as { data: { fulfilled_at: string | null; payment_method: string | null } | null };
  if (before?.fulfilled_at) return { error: "ההזמנה כבר טופלה" };
  // A retry writes the product's terms and messages the parent; neither is
  // right for a plan paid in Arbox. Staff record it again from the trainee.
  if (before?.payment_method === "arbox") return { error: "הזמנה מ-Arbox: רשמו אותה מחדש מדף המתאמן" };

  const result = await fulfillOrder(db, orderId);
  if (!result.ok) return { error: result.error };
  await notifyOrderFulfilled(db, orderId);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/plans");
  return { success: true };
}

/** Issues (or re-issues after a failure) the Morning receipt for a paid order. */
export async function issueInvoiceAction(orderId: string): Promise<ActionResult & { url?: string | null }> {
  const { error: authError, user, adminProfile } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(orderId)) return { error: "מזהה הזמנה לא תקין" };

  const outcome = await issueOrderInvoice(createAdminClient(), orderId, {
    id: user!.id,
    name: adminProfile?.full_name ?? null,
  });
  if (!outcome.ok) return { error: outcome.skipped ? "Morning אינו מוגדר עדיין" : `החשבונית לא הופקה: ${outcome.error}` };
  revalidatePath("/admin/orders");
  revalidatePath("/admin/plans");
  return { success: true, url: outcome.url };
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
