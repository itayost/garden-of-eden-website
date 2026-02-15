import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveTransaction } from "@/lib/grow/client";
import { verifyGrowWebhook, verifyGrowProcessToken } from "@/lib/webhook-security";
import { growWebhookSchema, type GrowWebhookPayload } from "@/lib/validations/webhook";
import type { PaymentUpdate, Json } from "@/types/database";

/**
 * GROW/Meshulam Webhook Handler
 *
 * This endpoint receives payment notifications from GROW.
 * After receiving a notification, it:
 * 1. Verifies webhook signature (HMAC-SHA256) or process token
 * 2. Validates payload with Zod schema
 * 3. Updates the payment record in the database
 * 4. Calls approveTransaction to acknowledge receipt
 */
export async function POST(request: NextRequest) {
  try {
    // Read raw body for signature verification (before parsing JSON)
    const rawBody = await request.text();

    // Try HMAC signature verification first (if GROW_WEBHOOK_SECRET is configured)
    const hasWebhookSecret = !!process.env.GROW_WEBHOOK_SECRET;

    if (hasWebhookSecret) {
      const signatureResult = verifyGrowWebhook(rawBody, request.headers);

      if (!signatureResult.valid) {
        console.error("[GROW Webhook] Signature verification failed:", signatureResult.error);
        return NextResponse.json(
          { error: signatureResult.error || "Invalid signature" },
          { status: 401 }
        );
      }

      console.log("[GROW Webhook] Signature verified successfully");
    }

    // Parse and validate with Zod
    let payload: GrowWebhookPayload;
    try {
      const rawPayload = JSON.parse(rawBody);
      const parseResult = growWebhookSchema.safeParse(rawPayload);

      if (!parseResult.success) {
        console.error("[GROW Webhook] Validation failed:", parseResult.error.issues);
        return NextResponse.json(
          { error: "Invalid payload format", details: parseResult.error.issues },
          { status: 400 }
        );
      }

      payload = parseResult.data;
    } catch (parseError) {
      console.error("[GROW Webhook] JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    console.log("[GROW Webhook] Received:", {
      processId: payload.data?.processId,
      statusCode: payload.data?.statusCode,
      sum: payload.data?.sum,
    });

    // If no HMAC secret, fall back to process token validation
    if (!hasWebhookSecret) {
      const expectedProcessToken = process.env.GROW_PROCESS_TOKEN;

      if (expectedProcessToken) {
        const tokenResult = verifyGrowProcessToken(
          { processToken: payload.data.processToken },
          expectedProcessToken
        );

        if (!tokenResult.valid) {
          console.error("[GROW Webhook] Process token verification failed:", tokenResult.error);
          return NextResponse.json(
            { error: tokenResult.error || "Invalid process token" },
            { status: 401 }
          );
        }

        console.log("[GROW Webhook] Process token verified successfully");
      } else {
        console.error("[GROW Webhook] CRITICAL: No verification mechanism configured. Set GROW_WEBHOOK_SECRET or GROW_PROCESS_TOKEN.");
        return NextResponse.json(
          { error: "Webhook verification not configured" },
          { status: 500 }
        );
      }
    }

    // Validate payload status
    if (payload.status !== "1" || !payload.data) {
      console.error("[GROW Webhook] Invalid payload status:", payload.status);
      return NextResponse.json(
        { error: "Invalid payload status" },
        { status: 400 }
      );
    }

    const data = payload.data;
    const supabase = createAdminClient();

    // Determine payment status from statusCode
    // statusCode: 2 = paid, other values may indicate different statuses
    const paymentStatus = data.statusCode === "2" ? "completed" : "failed";

    // Prepare update data
    // Note: paymentsNum, allPaymentsNum, firstPaymentSum, periodicalPaymentSum
    // are already transformed by Zod to numbers (with NaN handling)
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
      payments_num: data.paymentsNum,
      all_payments_num: data.allPaymentsNum,
      first_payment_sum: data.firstPaymentSum,
      periodical_payment_sum: data.periodicalPaymentSum,
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
    // Determine if recurring from cField2 (payment type stored during creation)
    const isRecurring = data.customFields?.cField2 === "recurring";

    // Build data object for approveTransaction (expects string values)
    const approveData = {
      asmachta: data.asmachta,
      cardSuffix: data.cardSuffix,
      cardType: data.cardType,
      cardTypeCode: data.cardTypeCode,
      cardBrand: data.cardBrand,
      cardBrandCode: data.cardBrandCode,
      cardExp: data.cardExp,
      // These need to be strings for the GROW API FormData
      firstPaymentSum: data.firstPaymentSum?.toString() ?? "",
      periodicalPaymentSum: data.periodicalPaymentSum?.toString() ?? "",
      status: data.status,
      statusCode: data.statusCode,
      transactionTypeId: data.transactionTypeId,
      paymentType: data.paymentType,
      sum: data.sum,
      paymentsNum: data.paymentsNum.toString(),
      allPaymentsNum: data.allPaymentsNum.toString(),
      paymentDate: data.paymentDate,
      description: data.description,
      fullName: data.fullName,
      payerPhone: data.payerPhone,
      payerEmail: data.payerEmail,
      transactionId: data.transactionId,
      transactionToken: data.transactionToken,
      processId: data.processId,
      processToken: data.processToken,
      payerBankAccountDetails: data.payerBankAccountDetails ?? "",
      customFields: data.customFields ?? {},
    };

    try {
      const approveResponse = await approveTransaction(approveData, isRecurring);

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
