"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { settingsSchema, type SettingsInput } from "@/lib/validations/weekly-reports";
import { actionFailure, firstIssue, type ActionResult } from "./staff-report";

/**
 * One branch's row of the settings card, Admins only: the mode (off or
 * approval until automatic mode opens), the pilot birth years (null for
 * every year) and whether "התגעגענו" goes out. Recorded with who changed it.
 */
export async function saveReportSettingsAction(input: SettingsInput): Promise<ActionResult> {
  const { error, user } = await verifyAdmin();
  if (error) return { error };
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  try {
    const db = createAdminClient();
    const { data: branch, error: branchError } = await db
      .from("branches")
      .select("id")
      .eq("id", parsed.data.branchId)
      .eq("is_active", true)
      .maybeSingle();
    if (branchError) throw new Error(branchError.message);
    if (!branch) return { error: "הסניף לא נמצא" };

    const { error: saveError } = await db.from("weekly_report_settings").upsert(
      {
        branch_id: parsed.data.branchId,
        mode: parsed.data.mode,
        birth_years: parsed.data.birthYears,
        missed_you: parsed.data.missedYou,
        changed_by: user!.id,
        changed_at: new Date().toISOString(),
      },
      { onConflict: "branch_id" },
    );
    if (saveError) throw new Error(saveError.message);
    revalidatePath("/admin/weekly-reports");
    return { success: true };
  } catch (failure) {
    return actionFailure("save settings", failure);
  }
}
