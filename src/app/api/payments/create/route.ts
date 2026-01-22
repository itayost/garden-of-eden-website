import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPaymentProcess, getWebhookBaseUrl } from "@/lib/grow/client";
import type { PaymentInsert } from "@/types/database";

interface CreatePaymentBody {
  amount: number;
  description: string;
  paymentType: "one_time" | "recurring";
  paymentNum?: number;
  maxPaymentNum?: number;
}

/**
 * Creates a new payment process and returns the payment URL
 * POST /api/payments/create
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile for name and phone
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Type assertion for profile data
    const profileData = profile as { full_name: string | null; phone: string | null };
    const fullName = profileData.full_name;
    const phone = profileData.phone;

    if (!fullName || !phone) {
      return NextResponse.json(
        { error: "Profile must have full name and phone" },
        { status: 400 }
      );
    }

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

    // Get base URL for callbacks
    const baseUrl = getWebhookBaseUrl();

    // Create payment process with GROW
    const growResponse = await createPaymentProcess({
      sum: body.amount,
      description: body.description,
      successUrl: `${baseUrl}/dashboard?payment=success`,
      cancelUrl: `${baseUrl}/dashboard?payment=cancelled`,
      fullName,
      phone,
      email: user.email,
      paymentNum: body.paymentNum,
      maxPaymentNum: body.maxPaymentNum,
      cField1: user.id, // Store user ID for webhook matching
      cField2: body.paymentType, // Store payment type
      notifyUrl: `${baseUrl}/api/webhooks/grow`,
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

    // Prepare insert data
    const insertData: PaymentInsert = {
      user_id: user.id,
      process_id: growResponse.data.processId,
      process_token: growResponse.data.processToken,
      amount: body.amount,
      description: body.description,
      payment_type: body.paymentType,
      payer_name: fullName,
      payer_phone: phone,
      payer_email: user.email,
      custom_fields: {
        cField1: user.id,
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
