"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { isValidUUID } from "@/lib/validations/common";
import { israelDateStr } from "@/lib/utils/israel-time";
import { getAgeGroup, type PlayerAssessment } from "@/types/assessment";
import { isAgeGroupId, nextBirthday, type AgeGroupProfile } from "@/lib/age-group-override";
import { writeRatingSnapshot } from "@/features/player-assessments/lib/snapshot";

type ActionResult = { success: true; until: string | null } | { error: string };

/**
 * Set or clear a staff-set age group for a trainee who trains with a younger
 * or older group. It lasts until his next birthday, worked out here from the
 * birthdate so no client can pick the end date; passing null clears it.
 *
 * Admins, and trainers for trainees in their branch. The write goes through
 * the service role (enforce_profile_column_guard refuses the columns to their
 * owner), the benchmarks follow through their profile trigger, and the
 * trainee's snapshots are rescored here so his card changes at once.
 */
export async function setAgeGroupOverride(
  userId: string,
  override: string | null
): Promise<ActionResult> {
  const { error: authError, user, profile: actor } = await verifyAdminOrTrainer();
  if (authError || !user) return { error: authError ?? "לא מחובר" };
  if (!isValidUUID(userId)) return { error: "מזהה משתמש לא תקין" };
  if (override !== null && !isAgeGroupId(override)) return { error: "קבוצת גיל לא תקינה" };

  const scopeError = await assertTraineeInScope(userId);
  if (scopeError) return { error: scopeError };

  const db = createAdminClient();
  const { data: trainee, error: readError } = await db
    .from("profiles")
    .select("role, birthdate")
    .eq("id", userId)
    .maybeSingle();
  if (readError) {
    console.error("setAgeGroupOverride read failed:", readError);
    return { error: "שמירה נכשלה" };
  }
  if (!trainee) return { error: "המשתמש לא נמצא" };
  if (trainee.role !== "trainee") return { error: "קבוצת גיל נקבעת רק למתאמנים" };

  let until: string | null = null;
  if (override !== null) {
    if (!trainee.birthdate) return { error: "יש להזין תאריך לידה קודם" };
    if (getAgeGroup(trainee.birthdate)?.id === override) {
      return { error: "זו כבר קבוצת הגיל שלו לפי תאריך הלידה" };
    }
    until = nextBirthday(trainee.birthdate, israelDateStr(new Date()));
  }

  const { error: updateError } = await db
    .from("profiles")
    .update({ age_group_override: override, age_group_override_until: until })
    .eq("id", userId);
  if (updateError) {
    console.error("setAgeGroupOverride failed:", updateError);
    return { error: "שמירה נכשלה" };
  }

  // Who moved a child between groups is what support will be asked, so it is
  // logged like the other staff profile changes. Best-effort.
  const { error: logError } = await db.from("activity_logs").insert({
    user_id: userId,
    action: "age_group_override_changed",
    actor_id: user.id,
    actor_name: actor?.full_name || "צוות",
    changes: { age_group_override: override, age_group_override_until: until },
  });
  if (logError) {
    console.error("setAgeGroupOverride activity log failed:", logError.message);
  }

  await rescoreTrainee(userId, {
    birthdate: trainee.birthdate,
    age_group_override: override,
    age_group_override_until: until,
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/assessments");
  revalidatePath("/dashboard", "layout");
  return { success: true, until };
}

/** Rescore one trainee's snapshots in his new group. Best-effort, like every snapshot write. */
async function rescoreTrainee(userId: string, profile: AgeGroupProfile): Promise<void> {
  const db = createAdminClient();
  const { data: assessments, error } = await db
    .from("player_assessments")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null);
  if (error) {
    console.error("setAgeGroupOverride rescore read failed:", error.message);
    return;
  }
  for (const assessment of (assessments ?? []) as PlayerAssessment[]) {
    await writeRatingSnapshot(db, assessment, profile);
  }
}
