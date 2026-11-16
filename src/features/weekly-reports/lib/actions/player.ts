"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { reportIdSchema, type ReportIdInput } from "@/lib/validations/weekly-reports";

type Result = { success: true } | { error: string };

const SAVE_FAILED = "שגיאה בשמירה. נסו שוב.";

/**
 * The player opened their sent Weekly report on the dashboard: stamps the
 * first open, once. Only for the signed-in Trainee's own sent row; another
 * Trainee's id, or a report that was not sent, is refused the same way.
 */
export async function markReportReadAction(input: ReportIdInput): Promise<Result> {
  const parsed = reportIdSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "מזהה דוח לא תקין" };
  const { reportId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const db = createAdminClient();
  const { data: row, error: readError } = await db
    .from("weekly_reports")
    .select("trainee_id, status, player_first_opened_at")
    .eq("id", reportId)
    .maybeSingle();
  if (readError) {
    console.error("[weekly-reports] read stamp lookup failed:", readError.message);
    return { error: SAVE_FAILED };
  }
  if (!row || row.trainee_id !== user.id || row.status !== "sent") return { error: "הדוח לא נמצא" };
  if (row.player_first_opened_at !== null) return { success: true };

  // Conditional on the empty stamp and the owner, so two tabs stamp once.
  const { error } = await db
    .from("weekly_reports")
    .update({ player_first_opened_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("trainee_id", user.id)
    .eq("status", "sent")
    .is("player_first_opened_at", null);
  if (error) {
    console.error("[weekly-reports] read stamp failed:", error.message);
    return { error: SAVE_FAILED };
  }
  return { success: true };
}
