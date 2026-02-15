"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { leadUpdateSchema, type LeadUpdateInput } from "@/lib/validations/leads";
import { isValidUUID } from "@/lib/validations/common";
import type { Lead, LeadStatus } from "@/types/leads";

type ActionResult =
  | { success: true; data?: Lead }
  | { error: string; fieldErrors?: Record<string, string[]> };

const VALID_STATUSES: LeadStatus[] = ["new", "callback", "in_progress", "closed", "disqualified"];

/**
 * Update a lead's fields
 *
 * - Validates with Zod schema
 * - Only includes defined fields in update
 * - Checks phone uniqueness if phone is being changed
 */
export async function updateLeadAction(input: LeadUpdateInput): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = leadUpdateSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { id, ...fields } = validated.data;
  const supabase = await createClient();

  // Build update object with only defined values
  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      // Treat empty string note as null
      updateData[key] = key === "note" && value === "" ? null : value;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return { error: "לא סופקו שדות לעדכון" };
  }

  // If phone is changing, check uniqueness
  if (updateData.phone) {
    const { data: existing } = await typedFrom(supabase, "leads")
      .select("id")
      .eq("phone", updateData.phone)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      return { error: "מספר טלפון כבר קיים במערכת" };
    }
  }

  const { data: updatedLead, error } = await typedFrom(supabase, "leads")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Update lead error:", error);
    return { error: "שגיאה בעדכון ליד" };
  }

  revalidatePath("/admin/leads");

  return { success: true, data: updatedLead as Lead };
}

/**
 * Quick-update a lead's status only
 */
export async function updateLeadStatusAction(
  id: string,
  status: LeadStatus
): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה לא תקין" };

  if (!VALID_STATUSES.includes(status)) {
    return { error: "סטטוס לא תקין" };
  }

  const supabase = await createClient();

  const { error } = await typedFrom(supabase, "leads").update({ status }).eq("id", id);

  if (error) {
    console.error("Update lead status error:", error);
    return { error: "שגיאה בעדכון סטטוס" };
  }

  revalidatePath("/admin/leads");

  return { success: true };
}
