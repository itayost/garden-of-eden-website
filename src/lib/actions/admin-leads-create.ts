"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { leadCreateSchema, type LeadCreateInput } from "@/lib/validations/leads";
import type { Lead } from "@/types/leads";

type ActionResult =
  | { success: true; data: Lead }
  | { error: string; fieldErrors?: Record<string, string[]> };

/**
 * Create a new lead
 *
 * - Validates input with Zod schema
 * - Checks the phone is not already in the target tab
 * - Inserts into leads table
 */
export async function createLeadAction(input: LeadCreateInput): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = leadCreateSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const {
    phone,
    name,
    is_from_haifa,
    status,
    source,
    tab_id,
    note,
    club,
    birth_year,
    additional_info,
    assigned_trainer_id,
  } = validated.data;

  const supabase = await createClient();

  let resolvedTabId = tab_id;
  if (!resolvedTabId) {
    const { data: defaultTab } = await typedFrom(supabase, "lead_tabs")
      .select("id")
      .eq("is_default", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (!defaultTab) return { error: "אין טאב ברירת מחדל" };
    resolvedTabId = defaultTab.id as string;
  }

  // A phone is unique within a tab; the same person may sit in another tab.
  const { data: existing } = await typedFrom(supabase, "leads")
    .select("id, name")
    .eq("tab_id", resolvedTabId)
    .eq("phone", phone)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const existingName = (existing as { name?: string | null }).name;
    return {
      error: existingName
        ? `מספר הטלפון כבר קיים בטאב הזה (${existingName})`
        : "מספר הטלפון כבר קיים בטאב הזה",
    };
  }

  const nullIfEmpty = (v: string | null | undefined) => (v ? v : null);
  const insertPayload = {
    phone,
    name,
    is_from_haifa,
    status,
    // Default to "organic" for admin-initiated manual creates — paid leads
    // come in via the webhook which sets `source` explicitly.
    source: source ?? "organic",
    tab_id: resolvedTabId,
    note: nullIfEmpty(note),
    club: nullIfEmpty(club),
    birth_year: birth_year ?? null,
    additional_info: nullIfEmpty(additional_info),
    assigned_trainer_id: assigned_trainer_id ?? null,
  };

  const { data: newLead, error } = await typedFrom(supabase, "leads")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    // 23505: the phone is already in this tab (added since the check above).
    if (error.code === "23505") return { error: "מספר הטלפון כבר קיים בטאב הזה" };
    console.error("Create lead error:", error);
    return { error: "שגיאה ביצירת ליד" };
  }

  revalidatePath("/admin/leads");

  return { success: true, data: newLead as Lead };
}
