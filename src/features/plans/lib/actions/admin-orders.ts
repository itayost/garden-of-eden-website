"use server";

import { revalidatePath } from "next/cache";
import { getBranchScopeAction, verifyAdmin, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { verifyAdminOrBranchManager } from "@/lib/actions/shared/verify-branch-manager";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import { fulfillOrder } from "@/features/enrollment/lib/fulfillment";
import { notifyOrderFulfilled } from "@/features/enrollment/lib/notify";
import { issueOrderInvoice } from "@/features/enrollment/lib/invoice";
import type { MorningWebhookEvent, Order } from "@/types/plans";
import { orderPlanName } from "@/lib/plans/manual-card";
import { paidNothing } from "@/lib/plans/paid";

export type AdminOrderRow = Order & {
  productName: string;
  agreementId: string | null;
  receivedByName: string | null;
  /** Who gave the Discount, for a sale below list price. */
  discountedByName: string | null;
  /** A Void or Refund whose Morning credit note number is not recorded yet. */
  refundAwaitingCreditNote: string | null;
};

type ActionResult = { success: true } | { error: string };

const ORDERS_LIMIT = 200;

type Db = ReturnType<typeof createAdminClient>;

/** Admin, or Branch manager of the order's branch; null when allowed. */
async function denyUnlessManagesOrder(db: Db, orderId: string): Promise<string | null> {
  const { data: order } = (await typedFrom(db, "orders")
    .select("branch_id")
    .eq("id", orderId)
    .maybeSingle()) as { data: { branch_id: string } | null };
  if (!order) return "ההזמנה לא נמצאה";
  return verifyAdminOrBranchManager([order.branch_id]);
}

const ORDER_SELECT =
  "*, product:plan_products(name_he), agreement:enrollment_agreements(id), receiver:profiles!orders_received_by_fkey(full_name), discounter:profiles!orders_discounted_by_fkey(full_name), refunds:plan_refunds(id, credit_note_number)";

type OrderJoinRow = Order & {
  product: { name_he: string } | null;
  agreement: { id: string }[] | null;
  receiver: { full_name: string | null } | null;
  discounter: { full_name: string | null } | null;
  refunds: { id: string; credit_note_number: string | null }[] | null;
};

function toAdminOrderRow({ product, agreement, receiver, discounter, refunds, ...order }: OrderJoinRow): AdminOrderRow {
  return {
    ...order,
    amount_ils: Number(order.amount_ils),
    list_price_ils: order.list_price_ils == null ? null : Number(order.list_price_ils),
    discountedByName: discounter?.full_name ?? null,
    productName: orderPlanName(product?.name_he ?? "", order),
    agreementId: agreement?.[0]?.id ?? null,
    receivedByName: receiver?.full_name ?? null,
    // Only a receipt in Morning has something to credit.
    refundAwaitingCreditNote: order.morning_document_url
      ? (refunds ?? []).find((r) => r.credit_note_number === null)?.id ?? null
      : null,
  };
}

/** Every order for an Admin; a Branch manager's branches for a Branch manager. */
export async function listOrdersAction(): Promise<AdminOrderRow[]> {
  const { error, profile } = await verifyAdminOrTrainer();
  if (error) return [];
  let managed: string[] | null = null;
  if (profile!.role !== "admin") {
    const scope = await getBranchScopeAction();
    if ("error" in scope || scope.data.managedBranchIds.length === 0) return [];
    managed = scope.data.managedBranchIds;
  }
  const db = createAdminClient();

  let query = typedFrom(db, "orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false })
    .limit(ORDERS_LIMIT);
  if (managed) query = query.in("branch_id", managed);
  const { data, error: readError } = (await query) as {
    data: OrderJoinRow[] | null;
    error: { message: string } | null;
  };
  if (readError) console.error("[admin-orders] list failed:", readError.message);
  return (data ?? []).map(toAdminOrderRow);
}

/** A sale below list price, for the Admins' list. */
export interface DiscountRow {
  id: string;
  childName: string;
  productName: string;
  amountIls: number;
  listPriceIls: number;
  reason: string | null;
  byName: string | null;
  createdAt: string;
  /** Given without charging rather than discounted. */
  free: boolean;
}

/** Every sale below list price, newest first: Admins only. */
export async function listDiscountedOrdersAction(): Promise<DiscountRow[]> {
  const { error } = await verifyAdmin();
  if (error) return [];
  const { data, error: readError } = (await typedFrom(createAdminClient(), "orders")
    .select(
      "id, child_name, amount_ils, list_price_ils, discount_reason, created_at, product:plan_products(name_he), discounter:profiles!orders_discounted_by_fkey(full_name)",
    )
    .not("list_price_ils", "is", null)
    .order("created_at", { ascending: false })
    .limit(ORDERS_LIMIT)) as {
    data:
      | (Pick<Order, "id" | "child_name" | "amount_ils" | "list_price_ils" | "discount_reason" | "created_at"> & {
          product: { name_he: string } | null;
          discounter: { full_name: string | null } | null;
        })[]
      | null;
    error: { message: string } | null;
  };
  if (readError) console.error("[admin-orders] discounts list failed:", readError.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    childName: row.child_name,
    productName: row.product?.name_he ?? "",
    amountIls: Number(row.amount_ils),
    listPriceIls: Number(row.list_price_ils),
    reason: row.discount_reason,
    byName: row.discounter?.full_name ?? null,
    createdAt: row.created_at,
    free: paidNothing(row),
  }));
}

/** Re-runs fulfillment for a paid order that failed; every step is idempotent. */
export async function retryFulfillmentAction(orderId: string): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  if (!isValidUUID(orderId)) return { error: "מזהה הזמנה לא תקין" };

  const db = createAdminClient();
  const denied = await denyUnlessManagesOrder(db, orderId);
  if (denied) return { error: denied };
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
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  if (!isValidUUID(orderId)) return { error: "מזהה הזמנה לא תקין" };

  const db = createAdminClient();
  const denied = await denyUnlessManagesOrder(db, orderId);
  if (denied) return { error: denied };
  const outcome = await issueOrderInvoice(db, orderId, {
    id: user!.id,
    name: profile?.full_name ?? null,
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
