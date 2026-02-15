"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { PhysicalMetricKey } from "../../types";
import type { Profile, PlayerGoalRow } from "@/types/database";
import { isLowerBetterMetric, GOAL_METRICS } from "../config/goal-config";
import { isValidUUID } from "@/lib/validations/common";

interface SetGoalParams {
  userId: string;
  metricKey: PhysicalMetricKey;
  targetValue: number;
  baselineValue?: number | null;
}

interface SetGoalResult {
  success: boolean;
  error?: string;
  goalId?: string;
}

/**
 * Create a new goal for a player
 * Only trainers and admins can create goals
 */
export async function setGoal(params: SetGoalParams): Promise<SetGoalResult> {
  if (!isValidUUID(params.userId)) {
    return { success: false, error: "מזהה משתמש לא תקין" };
  }

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
    return { success: false, error: "רק מאמנים יכולים להגדיר יעדים" };
  }

  // Verify target user exists and is a trainee
  const { data: targetProfile } = (await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", params.userId)
    .single()) as { data: Pick<Profile, "id" | "role"> | null };

  if (!targetProfile) {
    return { success: false, error: "המשתמש לא נמצא" };
  }

  if (targetProfile.role !== "trainee") {
    return { success: false, error: "ניתן להגדיר יעדים רק לחניכים" };
  }

  // Validate metric
  if (!GOAL_METRICS.includes(params.metricKey)) {
    return { success: false, error: "מדד לא תקין" };
  }

  // Validate target value
  if (params.targetValue <= 0) {
    return { success: false, error: "ערך היעד חייב להיות חיובי" };
  }

  // Validate that goal makes sense relative to baseline
  const isLowerBetter = isLowerBetterMetric(params.metricKey);
  if (params.baselineValue != null && params.baselineValue > 0) {
    if (isLowerBetter && params.targetValue >= params.baselineValue) {
      return {
        success: false,
        error: "עבור מדד זה, היעד צריך להיות נמוך מהערך הנוכחי",
      };
    }
    if (!isLowerBetter && params.targetValue <= params.baselineValue) {
      return {
        success: false,
        error: "עבור מדד זה, היעד צריך להיות גבוה מהערך הנוכחי",
      };
    }
  }

  // Check if there's already an active goal for this metric
  const { data: existingGoal } = (await supabase
    .from("player_goals")
    .select("id")
    .eq("user_id", params.userId)
    .eq("metric_key", params.metricKey)
    .is("achieved_at", null)
    .single()) as { data: { id: string } | null };

  if (existingGoal) {
    return { success: false, error: "כבר קיים יעד פעיל למדד זה" };
  }

  // Create the goal
  const { data, error } = (await supabase
    .from("player_goals")
    .insert({
      user_id: params.userId,
      metric_key: params.metricKey,
      target_value: params.targetValue,
      baseline_value: params.baselineValue ?? null,
      is_lower_better: isLowerBetter,
      created_by: user.id,
    })
    .select()
    .single()) as { data: PlayerGoalRow | null; error: { code?: string; message: string } | null };

  if (error) {
    console.error("Error setting goal:", error);
    if (error.code === "23505") {
      return { success: false, error: "כבר קיים יעד פעיל למדד זה" };
    }
    return { success: false, error: "שגיאה בהגדרת היעד" };
  }

  // Revalidate pages that show goals
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/assessments`);
  revalidatePath(`/admin/assessments/${params.userId}`);

  return { success: true, goalId: data?.id };
}
