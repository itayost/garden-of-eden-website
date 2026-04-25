import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerAssessment } from "@/types/assessment";
import { getAgeGroup } from "@/types/assessment";
import { calculateCardRatings, type CalculatedRatings } from "@/lib/assessment-to-rating";
import { fetchGroupStats } from "@/lib/utils/fetch-benchmarks";

export interface RatingSnapshotRow {
  user_id: string;
  assessment_id: string;
  assessment_date: string;
  age_group: string | null;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physical: number | null;
  overall_rating: number | null;
}

/** Pure: build a snapshot row from an assessment + ratings. */
export function composeSnapshot(input: {
  assessment: PlayerAssessment;
  ageGroupId: string | null;
  ratings: CalculatedRatings;
}): RatingSnapshotRow {
  const { assessment, ageGroupId, ratings } = input;
  return {
    user_id: assessment.user_id,
    assessment_id: assessment.id,
    assessment_date: assessment.assessment_date,
    age_group: ageGroupId,
    pace: ratings.pace,
    shooting: ratings.shooting,
    passing: ratings.passing,
    dribbling: ratings.dribbling,
    defending: ratings.defending,
    physical: ratings.physical,
    overall_rating: ratings.overall_rating,
  };
}

/**
 * Compute and UPSERT a rating snapshot for a single assessment.
 * Best-effort: errors are logged and swallowed — never fails the parent action.
 */
export async function writeRatingSnapshot(
  supabase: SupabaseClient,
  assessment: PlayerAssessment,
  birthdate: string | null
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const ageGroup = getAgeGroup(birthdate);
    if (!ageGroup) {
      return { ok: false, reason: "no_age_group" };
    }
    const benchmarks = await fetchGroupStats(supabase, ageGroup.id);
    if (!benchmarks) {
      return { ok: false, reason: "no_benchmarks" };
    }
    const ratings = calculateCardRatings(assessment, benchmarks);
    const row = composeSnapshot({ assessment, ageGroupId: ageGroup.id, ratings });
    const { error } = await supabase
      .from("player_rating_snapshots")
      .upsert(row, { onConflict: "assessment_id" });
    if (error) {
      console.error("writeRatingSnapshot upsert failed:", error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error("writeRatingSnapshot threw:", e);
    return { ok: false, reason: String(e) };
  }
}
