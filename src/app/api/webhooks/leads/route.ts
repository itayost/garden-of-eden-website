import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { leadWebhookSchema } from "@/lib/validations/leads";

/**
 * Leads Webhook Handler
 *
 * External webhook for lead creation from Zapier, landing pages, etc.
 * Authenticates via x-api-key header, validates payload with Zod,
 * checks phone uniqueness, and inserts into the leads table.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify API key with timing-safe comparison
    const apiKey = request.headers.get("x-api-key");
    const expectedKey = process.env.LEADS_WEBHOOK_API_KEY;
    if (!apiKey || !expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const a = Buffer.from(apiKey, "utf-8");
      const b = Buffer.from(expectedKey, "utf-8");
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate body
    const rawBody = await request.json();
    const parseResult = leadWebhookSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { phone, name, is_from_haifa, note } = parseResult.data;
    const supabase = createAdminClient();

    // Check phone uniqueness
    const { data: existing } = await typedFrom(supabase, "leads")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Lead already exists", leadId: existing.id },
        { status: 409 }
      );
    }

    // Insert new lead
    const { data: newLead, error: insertError } = await typedFrom(
      supabase,
      "leads"
    )
      .insert({ phone, name, is_from_haifa, note: note || null })
      .select("id")
      .single();

    if (insertError) {
      console.error("[Leads Webhook] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create lead" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, leadId: newLead.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Leads Webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
