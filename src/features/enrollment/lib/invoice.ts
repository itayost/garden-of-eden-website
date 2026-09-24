import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import { isMorningConfigured } from "@/lib/morning/config";
import { createReceiptDocument } from "@/lib/morning/documents";
import type { ReceiptPayment } from "@/lib/morning/payment-mapping";
import type { CardBrand } from "@/lib/payments/card";
import { israelToday } from "@/lib/utils/tasks";
import type { Order, PlanProduct } from "@/types/plans";

export type InvoiceOutcome =
  | { ok: true; url: string | null; alreadyIssued: boolean }
  | { ok: false; error: string; skipped: boolean };

const NOT_CONFIGURED = "Morning אינו מוגדר";

function paymentFor(order: Order): ReceiptPayment {
  switch (order.payment_method) {
    case "transfer":
      return { kind: "transfer", reference: order.reference };
    case "bit":
      return { kind: "bit", reference: order.reference };
    case "cash":
      return { kind: "cash" };
    default:
      return {
        kind: "card",
        brand: (order.card_brand as CardBrand | null) ?? "unknown",
        last4: order.card_last4 ?? "",
        installments: order.installments,
      };
  }
}

/**
 * Issues the Morning receipt for a paid order and stores the document on it.
 * Idempotent: an order that already has a document returns its url. Never
 * throws; a failure lands in fulfillment_error for the orders page to retry.
 */
export async function issueOrderInvoice(
  db: SupabaseClient,
  orderId: string,
  actor: { id: string | null; name: string | null },
): Promise<InvoiceOutcome> {
  if (!isMorningConfigured()) return { ok: false, error: NOT_CONFIGURED, skipped: true };

  const { data: order } = (await typedFrom(db, "orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle()) as { data: Order | null };
  if (!order) return { ok: false, error: "ההזמנה לא נמצאה", skipped: false };
  if (order.status !== "paid") return { ok: false, error: "ההזמנה לא שולמה", skipped: false };
  // Arbox issued its own receipt. paymentFor would fall through to a card
  // receipt here, so an Arbox order must never reach Morning.
  if (order.payment_method === "arbox") {
    return { ok: false, error: "שולם ב-Arbox: הקבלה הופקה שם", skipped: false };
  }
  if (order.morning_document_id) return { ok: true, url: order.morning_document_url, alreadyIssued: true };

  const { data: product } = (await typedFrom(db, "plan_products")
    .select("name_he")
    .eq("id", order.product_id)
    .maybeSingle()) as { data: Pick<PlanProduct, "name_he"> | null };

  const doc = await createReceiptDocument({
    description: `${product?.name_he ?? "מסלול"} - ${order.child_name}`,
    amountIls: Number(order.amount_ils),
    paidOn: order.paid_at ? order.paid_at.slice(0, 10) : israelToday(),
    client: { name: order.parent_name, phone: order.payer_phone, email: order.email },
    payment: paymentFor(order),
  });

  if (!doc.ok) {
    await typedFrom(db, "orders")
      .update({ fulfillment_error: `invoice: ${doc.error}` })
      .eq("id", orderId);
    return { ok: false, error: doc.error, skipped: false };
  }

  const clearInvoiceError =
    order.fulfillment_error?.startsWith("invoice:") ? { fulfillment_error: null } : {};
  await typedFrom(db, "orders")
    .update({ morning_document_id: doc.id, morning_document_url: doc.url, ...clearInvoiceError })
    .eq("id", orderId);

  if (order.profile_id) {
    await db.from("activity_logs").insert({
      user_id: order.profile_id,
      action: "invoice_issued",
      actor_id: actor.id,
      actor_name: actor.name ?? "מערכת",
      metadata: { orderId, documentId: doc.id, method: order.payment_method },
    });
  }
  return { ok: true, url: doc.url, alreadyIssued: false };
}
