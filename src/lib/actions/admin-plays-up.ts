"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { isValidUUID } from "@/lib/validations/common";

type ActionResult = { success: true } | { error: string };

/**
 * Set or clear the A mark: staff cleared this trainee to train with an older
 * birth year, and the calendar shows an "A" by his name. It changes nothing
 * else; booking, plans and age group ignore it.
 *
 * Admins, and trainers for trainees in their branch. The write goes through
 * the service role (enforce_profile_column_guard refuses the column to its
 * owner) and is logged like the age group.
 */
export async function setPlaysUp(userId: string, playsUp: boolean): Promise<ActionResult> {
  const { error: authError, user, profile: actor } = await verifyAdminOrTrainer();
  if (authError || !user) return { error: authError ?? "לא מחובר" };
  if (!isValidUUID(userId)) return { error: "מזהה משתמש לא תקין" };
  if (typeof playsUp !== "boolean") return { error: "ערך לא תקין" };

  const scopeError = await assertTraineeInScope(userId);
  if (scopeError) return { error: scopeError };

  const db = createAdminClient();
  const { data: trainee, error: readError } = await db
    .from("profiles")
    .select("role, plays_up")
    .eq("id", userId)
    .maybeSingle();
  if (readError) {
    console.error("setPlaysUp read failed:", readError);
    return { error: "שמירה נכשלה" };
  }
  if (!trainee) return { error: "המשתמש לא נמצא" };
  if (trainee.role !== "trainee") return { error: "הסימון נקבע רק למתאמנים" };
  if (trainee.plays_up === playsUp) return { success: true };

  const { error: updateError } = await db.from("profiles").update({ plays_up: playsUp }).eq("id", userId);
  if (updateError) {
    console.error("setPlaysUp failed:", updateError);
    return { error: "שמירה נכשלה" };
  }

  // Best-effort, like the other staff profile changes.
  const { error: logError } = await db.from("activity_logs").insert({
    user_id: userId,
    action: "plays_up_changed",
    actor_id: user.id,
    actor_name: actor?.full_name || "צוות",
    changes: [{ field: "plays_up", old_value: trainee.plays_up, new_value: playsUp }],
  });
  if (logError) {
    console.error("setPlaysUp activity log failed:", logError.message);
  }

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/calendar");
  return { success: true };
}
