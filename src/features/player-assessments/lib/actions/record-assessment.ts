// src/features/player-assessments/lib/actions/record-assessment.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { typedFrom } from "@/lib/supabase/helpers";
import type { PlayerAssessment } from "@/types/assessment";
import { writeRatingSnapshot } from "../snapshot";
import { grantAssessmentBadges } from "@/features/achievements/lib/actions/grant-assessment-badges";

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
  coordination?: PlayerAssessment["coordination"];
  leg_power_technique?: PlayerAssessment["leg_power_technique"];
  body_structure?: PlayerAssessment["body_structure"];
  kick_power_kaiser?: number | null;
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
 * After insert: recomputes ratings and writes a snapshot, then grants any
 * earned badges. Both are best-effort — failures don't fail the assessment.
 */
export async function recordAssessment(
  input: AssessmentInsertInput
): Promise<RecordResult> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError || !user) return { success: false, error: authError ?? "unauthorized" };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "player_assessments")
    .insert({ ...input, assessed_by: user.id })
    .select("*")
    .single();
  if (error || !data) {
    return { success: false, error: error?.message ?? "insert failed" };
  }
  const assessment = data as PlayerAssessment;

  // Best-effort post-write: snapshot then badges.
  const { data: profile } = await supabase
    .from("profiles")
    .select("birthdate")
    .eq("id", assessment.user_id)
    .single();
  await writeRatingSnapshot(supabase, assessment, (profile as { birthdate: string | null } | null)?.birthdate ?? null);
  await grantAssessmentBadges(supabase, assessment);

  return { success: true, data: assessment };
}

/**
 * Update an existing assessment row (used by the multi-step admin form
 * which writes one step at a time). Re-snapshots after the update so the
 * cached rating reflects the latest values.
 */
export async function updateAssessment(
  assessmentId: string,
  patch: Partial<AssessmentInsertInput>
): Promise<RecordResult> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError || !user) return { success: false, error: authError ?? "unauthorized" };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "player_assessments")
    .update({ ...patch, assessed_by: user.id })
    .eq("id", assessmentId)
    .select("*")
    .single();
  if (error || !data) {
    return { success: false, error: error?.message ?? "update failed" };
  }
  const assessment = data as PlayerAssessment;

  const { data: profile } = await supabase
    .from("profiles")
    .select("birthdate")
    .eq("id", assessment.user_id)
    .single();
  await writeRatingSnapshot(supabase, assessment, (profile as { birthdate: string | null } | null)?.birthdate ?? null);
  // Note: badge grants only fire on assessment INSERT, not on subsequent
  // step UPDATEs, to avoid double-granting as the multi-step form fills out.
  return { success: true, data: assessment };
}
