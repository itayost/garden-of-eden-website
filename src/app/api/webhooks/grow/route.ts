import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveTransaction, WebhookPayload } from "@/lib/grow/client";
import type { PaymentUpdate, Json } from "@/types/database";

/**
 * GROW/Meshulam Webhook Handler
 *
 * This endpoint receives payment notifications from GROW.
 * After receiving a notification, it:
 * 1. Updates the payment record in the database
 * 2. Calls approveTransaction to acknowledge receipt
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the webhook payload
    const payload: WebhookPayload = await request.json();

    console.log("[GROW Webhook] Received payload:", JSON.stringify(payload, null, 2));

    // Validate payload
    if (payload.status !== "1" || !payload.data) {
      console.error("[GROW Webhook] Invalid payload status:", payload.status);
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    const data = payload.data;
    const supabase = createAdminClient();

    // Determine payment status from statusCode
    // statusCode: 2 = paid, other values may indicate different statuses
    const paymentStatus = data.statusCode === "2" ? "completed" : "failed";

    // Prepare update data
    const updateData: PaymentUpdate = {
      transaction_id: data.transactionId,
      transaction_token: data.transactionToken,
      asmachta: data.asmachta,
      status: paymentStatus as "completed" | "failed",
      status_code: data.statusCode,
      card_suffix: data.cardSuffix,
      card_type: data.cardType,
      card_brand: data.cardBrand,
      card_exp: data.cardExp,
      payments_num: parseInt(data.paymentsNum) || 1,
      all_payments_num: parseInt(data.allPaymentsNum) || 1,
      first_payment_sum: parseFloat(data.firstPaymentSum) || null,
      periodical_payment_sum: parseFloat(data.periodicalPaymentSum) || null,
      webhook_received_at: new Date().toISOString(),
      raw_webhook_data: payload as unknown as Json,
    };

    // Update the payment record
    // Using type assertion since payments table is new and types may not be fully synced
    const { error: updateError } = await (supabase
      .from("payments") as ReturnType<typeof supabase.from>)
      .update(updateData)
      .eq("process_id", data.processId)
      .eq("process_token", data.processToken);

    if (updateError) {
      console.error("[GROW Webhook] Failed to update payment:", updateError);
      // Still try to approve the transaction
    }

    // Call approveTransaction to acknowledge receipt
    try {
      const approveResponse = await approveTransaction(data);

      if (approveResponse.status === 1) {
        // Update approved_at timestamp
        await (supabase
          .from("payments") as ReturnType<typeof supabase.from>)
          .update({ approved_at: new Date().toISOString() })
          .eq("process_id", data.processId);

        console.log("[GROW Webhook] Transaction approved successfully");
      } else {
        console.error("[GROW Webhook] Failed to approve transaction:", approveResponse.err);
      }
    } catch (approveError) {
      console.error("[GROW Webhook] Error approving transaction:", approveError);
      // Don't fail the webhook - GROW says transaction processes anyway
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[GROW Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Also handle GET for testing endpoint connectivity
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "GROW webhook endpoint is active",
  });
}
