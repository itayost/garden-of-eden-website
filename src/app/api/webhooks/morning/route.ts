import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { getMorningConfig } from "@/lib/morning/config";
import {
  extractOrderId,
  verifyMorningSignature,
  type MorningDocumentCreated,
  type MorningPaymentReceived,
} from "@/lib/morning/webhook";
import { fulfillOrder } from "@/features/enrollment/lib/fulfillment";
import { notifyOrderFulfilled } from "@/features/enrollment/lib/notify";

/**
 * Morning webhooks (Developer Tools > Webhooks, topics payment/received and
 * document/created). This is the only path that marks an order paid.
 *
 * Every delivery is stored once by its delivery id; a retried delivery is
 * acknowledged and ignored. Anything that fails after the signature check is
 * still acknowledged with 200 and recorded on the event row, because Morning
 * disables a webhook after fifteen failures and the fix belongs on our side.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const { webhookSecret } = getMorningConfig();

  if (
    !verifyMorningSignature(rawBody, request.headers.get("x-webhook-signature"), webhookSecret)
  ) {
    console.error("[Morning Webhook] signature mismatch");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const deliveryId = request.headers.get("x-webhook-delivery-id") ?? "";
  const topic = request.headers.get("x-webhook-topic") ?? "";
  if (!deliveryId || !topic) {
    return NextResponse.json({ error: "Missing webhook headers" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = createAdminClient();
  const custom = (payload as { custom?: unknown }).custom;
  const orderId = extractOrderId(custom);

  const { error: insertError } = await typedFrom(db, "morning_webhook_events").insert({
    delivery_id: deliveryId,
    topic,
    payload,
    order_id: orderId,
  });
  if (insertError) {
    // 23505 = already stored: a retry of a delivery we handled.
    if (insertError.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    console.error("[Morning Webhook] event insert failed:", insertError);
    return NextResponse.json({ error: "Storage failed" }, { status: 500 });
  }

  const finish = async (error: string | null) => {
    await typedFrom(db, "morning_webhook_events")
      .update({ processed_at: new Date().toISOString(), error })
      .eq("delivery_id", deliveryId);
    return NextResponse.json({ ok: true, error });
  };

  if (!orderId) return finish("no order id in custom");

  if (topic === "payment/received") {
    const event = payload as MorningPaymentReceived;
    const transactionId = event.transactions?.[0]?.id ?? event.id ?? null;

    const { data: order } = (await typedFrom(db, "orders")
      .select("id, status, amount_ils")
      .eq("id", orderId)
      .maybeSingle()) as { data: { id: string; status: string; amount_ils: number } | null };
    if (!order) return finish("order not found");
    if (order.status === "paid") return finish(null);

    // Morning fixes the price on its side, but a partial capture or an edited
    // form must not hand out a full plan.
    const paidAmount = Number(event.total ?? event.transactions?.[0]?.total ?? NaN);
    if (Number.isFinite(paidAmount) && paidAmount !== Number(order.amount_ils)) {
      return finish(`amount mismatch: paid ${paidAmount}, order ${order.amount_ils}`);
    }

    // Claim the order: only the delivery whose update touched a row goes on
    // to fulfill, so two concurrent deliveries cannot both create a plan. A
    // checkout the cron already expired is still a real payment.
    const { data: claimed, error: updateError } = (await typedFrom(db, "orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        morning_transaction_id: transactionId,
        raw_webhook: payload,
      })
      .eq("id", orderId)
      .in("status", ["pending", "expired"])
      .select("id")) as { data: { id: string }[] | null; error: { code?: string; message: string } | null };
    if (updateError) {
      if (updateError.code === "23505") return finish("transaction id already used");
      return finish(`order update failed: ${updateError.message}`);
    }
    if (!claimed || claimed.length === 0) return finish("order already claimed");

    const result = await fulfillOrder(db, orderId);
    if (!result.ok) return finish(`fulfillment: ${result.error}`);

    await notifyOrderFulfilled(db, orderId);
    return finish(null);
  }

  if (topic === "document/created") {
    const event = payload as MorningDocumentCreated;
    await typedFrom(db, "orders")
      .update({
        morning_document_id: event.id ?? null,
        morning_document_url:
          event.files?.downloadLinks?.he ?? event.files?.downloadLinks?.origin ?? null,
      })
      .eq("id", orderId);
    return finish(null);
  }

  return finish(`unhandled topic ${topic}`);
}
