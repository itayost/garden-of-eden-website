import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPaymentProcess, getWebhookBaseUrl } from "@/lib/grow/client";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import {
  createPaymentSchema,
  formatZodErrors,
  type CreatePaymentInput,
} from "@/lib/validations/payment";
import type { PaymentInsert } from "@/types/database";

/**
 * Creates a new payment process and returns the payment URL
 * POST /api/payments/create
 *
 * This endpoint does NOT require authentication - anyone can initiate a payment.
 * The payer details (name, phone, email) are provided in the request body.
 *
 * Security:
 * - Rate limited to 10 requests/hour per IP
 * - Input validated via Zod schema with Hebrew error messages
 */
export async function POST(request: NextRequest) {
  try {
    // Get IP for rate limiting (anonymous endpoint)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const identifier = getRateLimitIdentifier(null, ip);

    // Check rate limit (10/hour for payment endpoint)
    const rateLimitResult = await checkRateLimit(identifier, "payment");

    // Handle rate limit analytics in background
    waitUntil(rateLimitResult.pending);

    if (rateLimitResult.rateLimited) {
      // Vague message per CONTEXT.md - don't reveal rate limiting mechanism
      return NextResponse.json(
        { error: "הבקשה נכשלה. נסה שוב מאוחר יותר" },
        { status: 429 }
      );
    }

    // Parse request body
    const rawBody = await request.json();

    // Validate with Zod schema
    const parseResult = createPaymentSchema.safeParse(rawBody);

    if (!parseResult.success) {
      // Return field-level errors for form validation
      return NextResponse.json(
        {
          error: "נתונים לא תקינים",
          fieldErrors: formatZodErrors(parseResult.error),
        },
        { status: 400 }
      );
    }

    // Use validated data from here on
    const body: CreatePaymentInput = parseResult.data;

    // Get base URL for callbacks
    const baseUrl = getWebhookBaseUrl();

    // Create payment process with GROW
    // Use different page code for recurring vs one-time payments
    const isRecurring = body.paymentType === "recurring";
    const growResponse = await createPaymentProcess({
      sum: body.amount,
      description: body.description,
      successUrl: `${baseUrl}/?payment=success`,
      cancelUrl: `${baseUrl}/?payment=cancelled`,
      fullName: body.payerName.trim(),
      phone: body.payerPhone,
      email: body.payerEmail || undefined,
      paymentNum: body.paymentNum,
      maxPaymentNum: body.maxPaymentNum,
      cField1: body.payerPhone, // Store phone for matching
      cField2: body.paymentType, // Store payment type
      notifyUrl: `${baseUrl}/api/webhooks/grow`,
      isRecurring,
    });

    if (growResponse.status !== 1 || !growResponse.data) {
      console.error("[Payment] GROW API error:", growResponse.err);
      const errorMessage =
        typeof growResponse.err === "object"
          ? growResponse.err.message
          : growResponse.err || "Payment creation failed";
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Use admin client to insert payment (bypasses RLS)
    const adminSupabase = createAdminClient();

    // Prepare insert data (no user_id - anonymous payment)
    const insertData: PaymentInsert = {
      user_id: null,
      process_id: growResponse.data.processId,
      process_token: growResponse.data.processToken,
      amount: body.amount,
      description: body.description,
      payment_type: body.paymentType,
      payer_name: body.payerName.trim(),
      payer_phone: body.payerPhone,
      payer_email: body.payerEmail || null,
      custom_fields: {
        cField1: body.payerPhone,
        cField2: body.paymentType,
      },
    };

    // Store payment record in database
    const { error: insertError } = await (
      adminSupabase.from("payments") as ReturnType<typeof adminSupabase.from>
    ).insert(insertData);

    if (insertError) {
      console.error("[Payment] Failed to store payment record:", insertError);
      // Continue anyway - payment was created in GROW
    }

    // Return payment URL for redirect
    return NextResponse.json({
      success: true,
      paymentUrl: growResponse.data.url,
    });
  } catch (error) {
    console.error("[Payment] Error creating payment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
