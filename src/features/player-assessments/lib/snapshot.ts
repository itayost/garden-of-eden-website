import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerAssessment } from "@/types/assessment";
import {
  calculateCardRatings,
  type CalculatedRatings,
  type GroupStats,
} from "@/lib/assessment-to-rating";
import { fetchGroupStats } from "@/lib/utils/fetch-benchmarks";
import { resolveAgeGroup, type AgeGroupProfile } from "@/lib/age-group-override";

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

export type RateResult =
  | { ok: true; row: RatingSnapshotRow }
  | { ok: false; reason: "no_age_group" | "no_benchmarks" };

/**
 * Pure: rate one assessment against the benchmarks of the age group the
 * player was in on the assessment date (a staff-set group while it lasts).
 * `statsByGroup` maps AgeGroup.id to that group's benchmarks (null when it has
 * fewer than two players).
 */
export function rateAssessment(
  assessment: PlayerAssessment,
  profile: AgeGroupProfile | null,
  statsByGroup: ReadonlyMap<string, GroupStats | null>
): RateResult {
  const ageGroup = profile ? resolveAgeGroup(profile, assessment.assessment_date) : null;
  if (!ageGroup) return { ok: false, reason: "no_age_group" };
  const benchmarks = statsByGroup.get(ageGroup.id) ?? null;
  if (!benchmarks) return { ok: false, reason: "no_benchmarks" };
  const ratings = calculateCardRatings(assessment, benchmarks);
  return { ok: true, row: composeSnapshot({ assessment, ageGroupId: ageGroup.id, ratings }) };
}

/** The profile columns that decide a trainee's age group. */
export const AGE_GROUP_PROFILE_COLUMNS = "birthdate, age_group_override, age_group_override_until";

/**
 * Compute and UPSERT a rating snapshot for a single assessment.
 * Best-effort: errors are logged and swallowed — never fails the parent action.
 *
 * `profileOverride` lets bulk callers pre-fetch the age-group columns and
 * avoid an extra round-trip per assessment. Pass `undefined` to have this
 * helper look them up; pass `null` to assert the trainee has no profile.
 */
export async function writeRatingSnapshot(
  supabase: SupabaseClient,
  assessment: PlayerAssessment,
  profileOverride?: AgeGroupProfile | null
): Promise<{ ok: boolean; reason?: string }> {
  try {
    let profile: AgeGroupProfile | null;
    if (profileOverride === undefined) {
      const { data } = await supabase
        .from("profiles")
        .select(AGE_GROUP_PROFILE_COLUMNS)
        .eq("id", assessment.user_id)
        .single();
      profile = (data as AgeGroupProfile | null) ?? null;
    } else {
      profile = profileOverride;
    }

    const ageGroup = profile ? resolveAgeGroup(profile, assessment.assessment_date) : null;
    const stats = new Map<string, GroupStats | null>();
    if (ageGroup) stats.set(ageGroup.id, await fetchGroupStats(supabase, ageGroup.id));
    const rated = rateAssessment(assessment, profile, stats);
    if (!rated.ok) return { ok: false, reason: rated.reason };
    const { row } = rated;
    // Force computed_at to advance on every write — the DB DEFAULT only
    // fires on INSERT, so an UPSERT that lands on UPDATE would otherwise
    // leave computed_at stale and we'd lose the audit signal.
    const { error } = await supabase
      .from("player_rating_snapshots")
      .upsert(
        { ...row, computed_at: new Date().toISOString() },
        { onConflict: "assessment_id" }
      );
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
