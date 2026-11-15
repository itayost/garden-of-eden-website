"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { leadUpdateSchema, type LeadUpdateInput } from "@/lib/validations/leads";
import { isValidUUID } from "@/lib/validations/common";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/types/leads";

type ActionResult =
  | { success: true; data?: Lead }
  | { error: string; fieldErrors?: Record<string, string[]> };

const NULLABLE_TEXT_KEYS = new Set(["note", "club", "additional_info"]);

/**
 * Update a lead's fields
 *
 * - Validates with Zod schema
 * - Only includes defined fields in update
 * - Checks the phone is not already in the lead's tab when the phone or tab changes
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

  // Keep only defined fields; coerce "" → null for nullable text columns.
  const entries = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [
      key,
      NULLABLE_TEXT_KEYS.has(key) && value === "" ? null : value,
    ] as const);

  if (entries.length === 0) {
    return { error: "לא סופקו שדות לעדכון" };
  }

  const updateData: Record<string, unknown> = Object.fromEntries(entries);

  // A phone is unique within a tab: check when the phone or the tab changes.
  if (updateData.phone || updateData.tab_id) {
    const { data: current } = await typedFrom(supabase, "leads")
      .select("phone, tab_id")
      .eq("id", id)
      .maybeSingle();
    if (!current) return { error: "ליד לא נמצא" };

    const phone = (updateData.phone ?? current.phone) as string | null;
    const tabId = (updateData.tab_id ?? current.tab_id) as string;
    if (phone) {
      const { data: existing } = await typedFrom(supabase, "leads")
        .select("id")
        .eq("tab_id", tabId)
        .eq("phone", phone)
        .neq("id", id)
        .limit(1)
        .maybeSingle();
      if (existing) return { error: "מספר הטלפון כבר קיים בטאב הזה" };
    }
  }

  const { data: updatedLead, error } = await typedFrom(supabase, "leads")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { error: "מספר הטלפון כבר קיים בטאב הזה" };
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

  if (!LEAD_STATUSES.includes(status)) {
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
