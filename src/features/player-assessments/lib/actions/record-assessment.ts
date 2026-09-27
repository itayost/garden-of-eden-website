// src/features/player-assessments/lib/actions/record-assessment.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { typedFrom } from "@/lib/supabase/helpers";
import type {
  BodyStructure,
  CoordinationLevel,
  LegPowerTechnique,
  PlayerAssessment,
} from "@/types/assessment";
import { writeRatingSnapshot } from "../snapshot";
import { grantAssessmentBadges } from "@/features/achievements/lib/actions/grant-assessment-badges";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { isValidUUID } from "@/lib/validations/common";
import { assessmentInsertFields, assessmentUpdateFields } from "../assessment-fields";

interface AssessmentInsertInput {
  user_id: string;
  assessment_date: string;
  sprint_5m?: number | null;
  sprint_10m?: number | null;
  sprint_20m?: number | null;
  jump_2leg_distance?: number | null;
  jump_right_leg?: number | null;
  jump_left_leg?: number | null;
  jump_2leg_height?: number | null;
  blaze_spot_time?: number | null;
  flexibility_ankle?: number | null;
  flexibility_knee?: number | null;
  flexibility_hip?: number | null;
  coordination?: CoordinationLevel | null;
  leg_power_technique?: LegPowerTechnique | null;
  body_structure?: BodyStructure | null;
  kick_power_kaiser?: number | null;
  kick_power_right_foot?: number | null;
  kick_power_left_foot?: number | null;
  kick_power_machine_pct?: number | null;
  concentration_notes?: string | null;
  decision_making_notes?: string | null;
  work_ethic_notes?: string | null;
  recovery_notes?: string | null;
  nutrition_notes?: string | null;
  notes?: string | null;
}

interface RecordResult {
  success: boolean;
  data?: PlayerAssessment;
  error?: string;
}

/**
 * The single sanctioned way to insert a new player_assessments row.
 * After insert: writes a rating snapshot and grants any earned badges.
 * Both post-write steps are best-effort — failures log but don't fail
 * the assessment write.
 */
export async function recordAssessment(
  input: AssessmentInsertInput
): Promise<RecordResult> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError || !user) return { success: false, error: authError ?? "unauthorized" };
  if (!isValidUUID(input.user_id)) return { success: false, error: "מזהה מתאמן לא תקין" };

  const scopeError = await assertTraineeInScope(input.user_id);
  if (scopeError) return { success: false, error: scopeError };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "player_assessments")
    .insert({ ...assessmentInsertFields(input), user_id: input.user_id, assessed_by: user.id })
    .select("*")
    .single();
  if (error || !data) {
    return { success: false, error: error?.message ?? "insert failed" };
  }
  const assessment = data as PlayerAssessment;

  // Service role for the post-write steps: player_rating_snapshots has no
  // write policy at all, and user_achievements lets a user insert only their
  // own badge, so the staff member's client was refused on both. The access
  // checks above (verifyAdminOrTrainer, assertTraineeInScope) already ran.
  const service = createAdminClient();
  await writeRatingSnapshot(service, assessment);
  await grantAssessmentBadges(service, assessment);

  return { success: true, data: assessment };
}

/**
 * Update an existing assessment row (used by the multi-step admin form
 * which writes one step at a time). Re-snapshots after the update so the
 * cached rating reflects the latest values.
 *
 * Why no badge grant: the multi-step form calls this once per step. Granting
 * on each call would double-grant as the form fills in. Badges only fire on
 * the initial INSERT in `recordAssessment`.
 */
export async function updateAssessment(
  assessmentId: string,
  patch: Partial<AssessmentInsertInput>
): Promise<RecordResult> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError || !user) return { success: false, error: authError ?? "unauthorized" };
  if (!isValidUUID(assessmentId)) return { success: false, error: "מזהה מבדק לא תקין" };

  const supabase = await createClient();
  const { data: existing } = (await typedFrom(supabase, "player_assessments")
    .select("user_id")
    .eq("id", assessmentId)
    .maybeSingle()) as { data: { user_id: string } | null };
  if (!existing) return { success: false, error: "מבדק לא נמצא" };

  const scopeError = await assertTraineeInScope(existing.user_id);
  if (scopeError) return { success: false, error: scopeError };

  const { data, error } = await typedFrom(supabase, "player_assessments")
    .update({ ...assessmentUpdateFields(patch), assessed_by: user.id })
    .eq("id", assessmentId)
    .select("*")
    .single();
  if (error || !data) {
    return { success: false, error: error?.message ?? "update failed" };
  }
  const assessment = data as PlayerAssessment;

  // Service role, as in recordAssessment: the staff client cannot write
  // snapshots, and the nightly backfill only fills missing ones, so an edit
  // would otherwise never reach the rating card.
  await writeRatingSnapshot(createAdminClient(), assessment);
  return { success: true, data: assessment };
}
