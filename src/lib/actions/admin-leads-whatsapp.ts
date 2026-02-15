"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { sendFlowTemplate, sendTextMessage } from "@/lib/whatsapp/client";
import type { Lead } from "@/types/leads";

type ActionResult =
  | { success: true }
  | { error: string };

/**
 * Fetch lead and validate for WhatsApp actions
 */
async function getLeadForWhatsApp(
  id: string
): Promise<{ lead: Lead } | { error: string }> {
  if (!isValidUUID(id)) return { error: "מזהה לא תקין" };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "leads")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return { error: "ליד לא נמצא" };

  return { lead: data as Lead };
}

/**
 * Log a sent message and contact log entry
 */
async function logWhatsAppMessage(
  leadId: string,
  messageId: string | null | undefined,
  messageType: "template" | "flow" | "text",
  notes: string
): Promise<void> {
  const supabase = await createClient();

  await Promise.all([
    typedFrom(supabase, "lead_sent_messages").insert({
      lead_id: leadId,
      message_id: messageId ?? null,
      message_type: messageType,
    }),
    typedFrom(supabase, "lead_contact_log").insert({
      lead_id: leadId,
      contact_type: "message_sent",
      notes,
    }),
  ]);

  revalidatePath("/admin/leads");
}

/**
 * Send a WhatsApp flow template message to a lead
 */
export async function sendWhatsAppFlowAction(leadId: string): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const leadResult = await getLeadForWhatsApp(leadId);
  if ("error" in leadResult) return { error: leadResult.error };

  try {
    const result = await sendFlowTemplate(leadResult.lead.phone, leadResult.lead.name);
    if (!result.success) {
      return { error: result.error || "שגיאה בשליחת תבנית WhatsApp" };
    }
    await logWhatsAppMessage(leadId, result.messageId, "template", "נשלחה תבנית פלואו WhatsApp");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Send WhatsApp flow error:", msg);
    return { error: `שגיאה בשליחת תבנית WhatsApp: ${msg}` };
  }
}

/**
 * Send a free-text WhatsApp message to a lead
 */
export async function sendWhatsAppTextAction(
  leadId: string,
  text: string
): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!text.trim()) return { error: "יש להזין טקסט להודעה" };

  const leadResult = await getLeadForWhatsApp(leadId);
  if ("error" in leadResult) return { error: leadResult.error };

  try {
    const result = await sendTextMessage(leadResult.lead.phone, text);
    if (!result.success) {
      return { error: result.error || "שגיאה בשליחת הודעת WhatsApp" };
    }
    const truncatedNote = text.length > 50 ? text.slice(0, 50) + "..." : text;
    await logWhatsAppMessage(leadId, result.messageId, "text", truncatedNote);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Send WhatsApp text error:", msg);
    return { error: `שגיאה בשליחת הודעת WhatsApp: ${msg}` };
  }
}
