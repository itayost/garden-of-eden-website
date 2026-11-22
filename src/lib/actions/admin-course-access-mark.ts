"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { israelDateStr } from "@/lib/utils/israel-time";
import { markProblem } from "@/lib/course-access/mark";

type ActionResult = { success: true } | { error: string };

/**
 * Mark a trainee active for courses through a last day, or clear the mark with
 * null. For someone who trains in a way neither Arbox nor the calendar sees.
 * Admin only; the write uses the service role because the column is guarded.
 */
export async function setCourseAccessMark(
  userId: string,
  until: string | null
): Promise<ActionResult> {
  const { error: authError, user, adminProfile } = await verifyAdmin();
  if (authError || !user) return { error: authError ?? "לא מחובר" };
  if (!isValidUUID(userId)) return { error: "מזהה משתמש לא תקין" };

  if (until !== null) {
    const problem = markProblem(until, israelDateStr(new Date()));
    if (problem) return { error: problem };
  }

  const db = createAdminClient();
  const { data: trainee, error: readError } = await db
    .from("profiles")
    .select("role, course_access_until, deleted_at")
    .eq("id", userId)
    .maybeSingle();
  if (readError) {
    console.error("setCourseAccessMark read failed:", readError);
    return { error: "שמירה נכשלה" };
  }
  if (!trainee) return { error: "המשתמש לא נמצא" };
  if (trainee.deleted_at !== null) return { error: "המשתמש נמחק" };
  if (trainee.role !== "trainee") return { error: "גישה לקורסים נקבעת רק למתאמנים" };

  const { error: updateError } = await db
    .from("profiles")
    .update({ course_access_until: until })
    .eq("id", userId);
  if (updateError) {
    console.error("setCourseAccessMark failed:", updateError);
    return { error: "שמירה נכשלה" };
  }

  // Best-effort audit trail, like the other staff profile changes.
  const { error: logError } = await db.from("activity_logs").insert({
    user_id: userId,
    action: "course_access_mark_changed",
    actor_id: user.id,
    actor_name: adminProfile?.full_name || "צוות",
    changes: [
      { field: "course_access_until", old_value: trainee.course_access_until, new_value: until },
    ],
  });
  if (logError) {
    console.error("setCourseAccessMark activity log failed:", logError.message);
  }

  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}
