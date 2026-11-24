import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { leadWebhookSchema } from "@/lib/validations/leads";
import { sendFlowTemplate } from "@/lib/whatsapp/client";
import {
  isPerTabCampaign,
  webhookLeadVerdict,
  type ExistingLead,
} from "@/lib/leads/webhook-duplicates";
import { tabByName, tabBySlug } from "@/lib/leads/webhook-tab";

/**
 * Leads Webhook Handler
 *
 * External webhook for lead creation from Zapier, landing pages, etc.
 * Authenticates via x-api-key header, validates payload with Zod,
 * picks the tab (tab_slug, else tab_name, found or made, else the default),
 * refuses a duplicate (a phone in any tab, or in the same tab for a tab with
 * its own campaign: webhookLeadVerdict), and inserts into the leads table.
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
      tab_name,
      club,
      birth_year,
      additional_info,
    } = parseResult.data;
    const supabase = createAdminClient();

    // tab_slug names a tab; else tab_name finds or makes one; else the
    // acquisition source's tab; else the default tab.
    const byName = !tab_slug && !!tab_name;
    const requestedSlug = tab_slug ?? (byName ? null : source ?? null);

    let tab_id: string;
    if (byName) {
      const tab = await tabByName(supabase, tab_name!);
      if ("error" in tab) {
        return NextResponse.json({ error: tab.error }, { status: tab.status });
      }
      if (tab.created) revalidatePath("/admin/leads");
      tab_id = tab.tabId;
    } else if (requestedSlug) {
      const tab = await tabBySlug(supabase, requestedSlug);
      if ("error" in tab) {
        return NextResponse.json({ error: tab.error }, { status: tab.status });
      }
      tab_id = tab.tabId;
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

    // An ad lead whose phone is already in any tab is not added again; a tab
    // with its own campaign refuses only a second copy in that tab. Staff may
    // keep one phone in several tabs, so read every match, newest first.
    const { data: existingRows, error: existingError } = await typedFrom(supabase, "leads")
      .select("id, tab_id")
      .eq("phone", phone)
      .order("created_at", { ascending: false });

    if (existingError) {
      console.error("[Leads Webhook] Duplicate check error:", existingError);
      return NextResponse.json(
        { error: "Failed to create lead" },
        { status: 500 }
      );
    }

    const verdict = webhookLeadVerdict({
      perTab: isPerTabCampaign({ slug: requestedSlug, byName }),
      targetTabId: tab_id,
      existing: (existingRows ?? []) as ExistingLead[],
    });

    if (verdict.duplicateOf) {
      return NextResponse.json(
        { error: "Lead already exists", leadId: verdict.duplicateOf },
        { status: 409 }
      );
    }

    // Insert new lead. `source` records the acquisition channel and is
    // independent of `tab_id` (the organizational bucket). Webhook traffic
    // defaults to "paid" because that's the dominant channel; callers can
    // override by sending `source: "organic"`.
    const { data: newLead, error: insertError } = await typedFrom(supabase, "leads")
      .insert({
        phone,
        name,
        is_from_haifa,
        note: note || null,
        source: source ?? "paid",
        tab_id,
        club: club || null,
        birth_year: birth_year ?? null,
        additional_info: additional_info || null,
      })
      .select("id")
      .single();

    // The same phone sent twice at once: the per-tab unique index refuses the second.
    if (insertError?.code === "23505") {
      return NextResponse.json(
        { error: "Lead already exists" },
        { status: 409 }
      );
    }

    if (insertError) {
      console.error("[Leads Webhook] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create lead" },
        { status: 500 }
      );
    }

    // Send WhatsApp Flow and log the result. A phone another tab already
    // holds got the flow when it first came in, so it is not sent twice.
    if (verdict.sendFlow) {
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
