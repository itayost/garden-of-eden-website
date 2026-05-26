import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { leadWebhookSchema } from "@/lib/validations/leads";
import { sendFlowTemplate } from "@/lib/whatsapp/client";

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
    const expectedKey = process.env.LEADS_WEBHOOK_API_KEY?.trim();
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

    const {
      phone,
      name,
      is_from_haifa,
      note,
      source,
      tab_slug,
      club,
      birth_year,
      additional_info,
    } = parseResult.data;
    const supabase = createAdminClient();

    const requestedSlug = tab_slug ?? source ?? null;

    let tab_id: string;
    if (requestedSlug) {
      const { data: tab } = await typedFrom(supabase, "lead_tabs")
        .select("id")
        .eq("slug", requestedSlug)
        .is("deleted_at", null)
        .maybeSingle();
      if (!tab) {
        return NextResponse.json(
          { error: "Invalid tab_slug" },
          { status: 400 },
        );
      }
      tab_id = tab.id as string;
    } else {
      const { data: defaultTab } = await typedFrom(supabase, "lead_tabs")
        .select("id")
        .eq("is_default", true)
        .is("deleted_at", null)
        .maybeSingle();
      if (!defaultTab) {
        return NextResponse.json(
          { error: "No default tab configured" },
          { status: 500 },
        );
      }
      tab_id = defaultTab.id as string;
    }

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
    const { data: newLead, error: insertError } = await typedFrom(supabase, "leads")
      .insert({
        phone,
        name,
        is_from_haifa,
        note: note || null,
        tab_id,
        club: club || null,
        birth_year: birth_year ?? null,
        additional_info: additional_info || null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[Leads Webhook] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create lead" },
        { status: 500 }
      );
    }

    // Send WhatsApp Flow and log the result
    try {
      const flowResult = await sendFlowTemplate(phone, name);
      if (flowResult.success) {
        const { error: logError } = await typedFrom(supabase, "lead_sent_messages").insert({
          lead_id: newLead.id,
          message_id: flowResult.messageId ?? null,
          message_type: "flow",
          campaign: "webhook_creation",
        });
        if (logError) {
          console.error("[Leads Webhook] Failed to log sent message:", logError);
        }
      } else {
        console.error("[Leads Webhook] Flow send failed:", flowResult.error);
      }
    } catch (flowErr) {
      console.error("[Leads Webhook] Flow send error:", flowErr);
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
