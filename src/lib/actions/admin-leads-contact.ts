"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { contactLogSchema, type ContactLogInput } from "@/lib/validations/leads";
import { isValidUUID } from "@/lib/validations/common";
import type { LeadContactLog } from "@/types/leads";

type ActionResult =
  | { success: true }
  | { error: string; fieldErrors?: Record<string, string[]> };

/**
 * Add a contact log entry for a lead
 */
export async function addContactLogAction(input: ContactLogInput): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = contactLogSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { lead_id, contact_type, rep, notes, outcome } = validated.data;

  const supabase = await createClient();

  const { error } = await typedFrom(supabase, "lead_contact_log").insert({
    lead_id,
    contact_type,
    rep: rep || null,
    notes: notes || null,
    outcome: outcome || null,
  });

  if (error) {
    console.error("Add contact log error:", error);
    return { error: "שגיאה בהוספת רישום יצירת קשר" };
  }

  revalidatePath("/admin/leads");

  return { success: true };
}

/**
 * Get contact log entries for a lead
 */
export async function getContactLogAction(
  leadId: string
): Promise<{ items: LeadContactLog[] } | { error: string }> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(leadId)) return { error: "מזהה לא תקין" };

  const supabase = await createClient();

  const { data, error } = await typedFrom(supabase, "lead_contact_log")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Get contact log error:", error);
    return { error: "שגיאה בטעינת יומן קשר" };
  }

  return { items: (data as LeadContactLog[]) || [] };
}
