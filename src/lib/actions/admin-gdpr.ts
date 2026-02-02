"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Profile,
  PreWorkoutForm,
  PostWorkoutForm,
  NutritionForm,
  VideoProgress,
} from "@/types/database";
import type { PlayerAssessment } from "@/types/assessment";
import { verifyAdmin } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";

/**
 * GDPR export data structure
 *
 * Includes (per CONTEXT.md):
 * - Profile data
 * - Form submissions (pre_workout, post_workout, nutrition)
 * - Assessments (excluding soft-deleted)
 * - Video progress
 *
 * Excludes (per CONTEXT.md):
 * - Activity logs
 * - Payment history
 * - Goals
 * - Achievements
 */
export interface GDPRExportData {
  exportedAt: string;
  userId: string;
  profile: Profile;
  preWorkoutForms: PreWorkoutForm[];
  postWorkoutForms: PostWorkoutForm[];
  nutritionForms: NutritionForm[];
  assessments: PlayerAssessment[];
  videoProgress: VideoProgress[];
}

type ActionResult =
  | { success: true; data: GDPRExportData }
  | { error: string };

/**
 * Export all user data for GDPR compliance
 *
 * Includes (per CONTEXT.md):
 * - Profile data
 * - Form submissions (pre_workout, post_workout, nutrition)
 * - Assessments (excluding soft-deleted)
 * - Video progress
 *
 * Excludes (per CONTEXT.md):
 * - Activity logs
 * - Payment history
 * - Goals
 * - Achievements
 */
export async function exportUserDataAction(
  userId: string
): Promise<ActionResult> {
  // 1. Verify admin
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  // 2. Validate userId
  if (!isValidUUID(userId)) {
    return { error: "מזהה משתמש לא תקין" };
  }

  // 3. Fetch all user data with adminClient
  const adminClient = createAdminClient();

  try {
    const [
      { data: profile },
      { data: preWorkoutForms },
      { data: postWorkoutForms },
      { data: nutritionForms },
      { data: assessments },
      { data: videoProgress },
    ] = await Promise.all([
      adminClient
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single() as unknown as { data: Profile | null },
      adminClient
        .from("pre_workout_forms")
        .select("*")
        .eq("user_id", userId)
        .order("submitted_at", { ascending: false }) as unknown as {
        data: PreWorkoutForm[] | null;
      },
      adminClient
        .from("post_workout_forms")
        .select("*")
        .eq("user_id", userId)
        .order("submitted_at", { ascending: false }) as unknown as {
        data: PostWorkoutForm[] | null;
      },
      adminClient
        .from("nutrition_forms")
        .select("*")
        .eq("user_id", userId)
        .order("submitted_at", { ascending: false }) as unknown as {
        data: NutritionForm[] | null;
      },
      adminClient
        .from("player_assessments")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("assessment_date", { ascending: false }) as unknown as {
        data: PlayerAssessment[] | null;
      },
      adminClient.from("video_progress").select("*").eq("user_id", userId) as unknown as {
        data: VideoProgress[] | null;
      },
    ]);

    if (!profile) {
      return { error: "המשתמש לא נמצא" };
    }

    return {
      success: true,
      data: {
        exportedAt: new Date().toISOString(),
        userId,
        profile,
        preWorkoutForms: preWorkoutForms || [],
        postWorkoutForms: postWorkoutForms || [],
        nutritionForms: nutritionForms || [],
        assessments: (assessments || []) as PlayerAssessment[],
        videoProgress: videoProgress || [],
      },
    };
  } catch (error) {
    console.error("GDPR export error:", error);
    return { error: "שגיאה בייצוא הנתונים" };
  }
}
