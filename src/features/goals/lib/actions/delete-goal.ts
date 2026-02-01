"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Profile } from "@/types/database";

interface DeleteGoalResult {
  success: boolean;
  error?: string;
}

/**
 * Delete a goal
 * Only trainers and admins can delete goals
 */
export async function deleteGoal(goalId: string): Promise<DeleteGoalResult> {
  const supabase = await createClient();

  // Verify caller is trainer or admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()) as { data: Pick<Profile, "role"> | null };

  if (!profile || !["trainer", "admin"].includes(profile.role)) {
    return { success: false, error: "רק מאמנים יכולים למחוק יעדים" };
  }

  // Verify the goal exists before attempting to delete
  const { data: goalToDelete } = (await supabase
    .from("player_goals")
    .select("id, user_id")
    .eq("id", goalId)
    .single()) as { data: { id: string; user_id: string } | null };

  if (!goalToDelete) {
    return { success: false, error: "היעד לא נמצא" };
  }

  const { error } = await supabase
    .from("player_goals")
    .delete()
    .eq("id", goalId);

  if (error) {
    console.error("Error deleting goal:", error);
    return { success: false, error: "שגיאה במחיקת היעד" };
  }

  // Revalidate pages
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/assessments");
  revalidatePath("/admin/assessments", "layout");

  return { success: true };
}
