import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPaymentProcess, getWebhookBaseUrl } from "@/lib/grow/client";
import type { PaymentInsert } from "@/types/database";

interface CreatePaymentBody {
  amount: number;
  description: string;
  paymentType: "one_time" | "recurring";
  payerName: string;
  payerPhone: string;
  payerEmail?: string;
  paymentNum?: number;
  maxPaymentNum?: number;
}

/**
 * Creates a new payment process and returns the payment URL
 * POST /api/payments/create
 *
 * This endpoint does NOT require authentication - anyone can initiate a payment.
 * The payer details (name, phone, email) are provided in the request body.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: CreatePaymentBody = await request.json();

    // Validate required fields
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    if (!body.description) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    if (!body.paymentType || !["one_time", "recurring"].includes(body.paymentType)) {
      return NextResponse.json(
        { error: "Invalid payment type" },
        { status: 400 }
      );
    }

    if (!body.payerName) {
      return NextResponse.json(
        { error: "Payer name is required" },
        { status: 400 }
      );
    }

    if (!body.payerPhone) {
      return NextResponse.json(
        { error: "Payer phone is required" },
        { status: 400 }
      );
    }

    // Validate phone format (Israeli: starts with 05, 10 digits)
    const phoneRegex = /^05\d{8}$/;
    if (!phoneRegex.test(body.payerPhone)) {
      return NextResponse.json(
        { error: "Invalid phone format" },
        { status: 400 }
      );
    }

    // Validate name (at least 2 words with 2+ chars each)
    const nameParts = body.payerName.trim().split(/\s+/);
    if (nameParts.length < 2 || nameParts.some((part) => part.length < 2)) {
      return NextResponse.json(
        { error: "Full name must include first and last name" },
        { status: 400 }
      );
    }

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
      email: body.payerEmail,
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
    const { error: insertError } = await (adminSupabase
      .from("payments") as ReturnType<typeof adminSupabase.from>)
      .insert(insertData);

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
