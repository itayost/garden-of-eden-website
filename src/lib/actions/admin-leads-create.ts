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
 * - Checks phone uniqueness
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

  const { phone, name, is_from_haifa, status, note } = validated.data;

  const supabase = await createClient();

  // Check phone uniqueness
  const { data: existing } = await typedFrom(supabase, "leads")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    return { error: "מספר טלפון כבר קיים במערכת" };
  }

  const { data: newLead, error } = await typedFrom(supabase, "leads")
    .insert({ phone, name, is_from_haifa, status, note: note || null })
    .select()
    .single();

  if (error) {
    console.error("Create lead error:", error);
    return { error: "שגיאה ביצירת ליד" };
  }

  revalidatePath("/admin/leads");

  return { success: true, data: newLead as Lead };
}
