import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerAssessment } from "@/types/assessment";
import { getAgeGroup } from "@/types/assessment";
import type { CalculatedRatings } from "@/lib/assessment-to-rating";
import {
  calculateCardRatings,
  calculateNeutralRatings,
  calculateGroupStats,
  getLatestAssessmentsPerUser,
} from "@/lib/assessment-to-rating";

export interface UserRatings {
  ratings: CalculatedRatings;
  groupAssessments: PlayerAssessment[];
}

export type TraineeProfile = { id: string; birthdate: string | null };

/**
 * Calculate FIFA-style card ratings for a user based on their assessments
 * and age-group percentile comparison.
 *
 * Pass `prefetchedTraineeProfiles` to avoid a redundant DB call when the
 * caller already has trainee profiles (e.g. fetched in a parallel Promise.all).
 *
 * Returns null if the user has no assessments.
 */
export async function calculateUserRatings(
  userId: string,
  assessments: PlayerAssessment[],
  birthdate: string | null,
  supabase: SupabaseClient,
  prefetchedTraineeProfiles?: TraineeProfile[] | null,
): Promise<UserRatings | null> {
  if (!assessments || assessments.length === 0) {
    return null;
  }

  const latestAssessment = assessments[assessments.length - 1];
  const ageGroup = getAgeGroup(birthdate);
  let groupAssessments: PlayerAssessment[] = [];
  let calculatedRatings: CalculatedRatings | null = null;

  if (ageGroup) {
    // Use pre-fetched profiles if available, otherwise fetch
    const ageGroupProfiles = prefetchedTraineeProfiles ?? (
      (await supabase
        .from("profiles")
        .select("id, birthdate")
        .eq("role", "trainee")) as unknown as {
        data: TraineeProfile[] | null;
      }
    ).data;

    const sameAgeGroupIds =
      ageGroupProfiles
        ?.filter((p) => {
          const pAgeGroup = getAgeGroup(p.birthdate);
          return pAgeGroup?.id === ageGroup.id;
        })
        .map((p) => p.id) || [];

    if (sameAgeGroupIds.length > 0) {
      // Only select columns used by calculateCardRatings / calculateGroupStats
      const { data: fetchedGroupAssessments } = await supabase
        .from("player_assessments")
        .select("id, user_id, assessment_date, sprint_5m, sprint_10m, sprint_20m, jump_2leg_distance, jump_right_leg, jump_left_leg, jump_2leg_height, blaze_spot_time, flexibility_ankle, flexibility_knee, flexibility_hip, kick_power_kaiser, coordination, body_structure, leg_power_technique")
        .in("user_id", sameAgeGroupIds);

      if (fetchedGroupAssessments && fetchedGroupAssessments.length > 0) {
        groupAssessments = fetchedGroupAssessments as PlayerAssessment[];

        // Filter to only latest assessment per user for fair comparison
        const latestAssessments =
          getLatestAssessmentsPerUser(groupAssessments);

        if (latestAssessments.length > 1) {
          const groupStats = calculateGroupStats(latestAssessments);
          calculatedRatings = calculateCardRatings(
            latestAssessment,
            groupStats
          );
        }
      }
    }
  }

  // Fallback to neutral ratings (50) if no group comparison available
  if (!calculatedRatings) {
    calculatedRatings = calculateNeutralRatings();
  }

  return {
    ratings: calculatedRatings,
    groupAssessments,
  };
}
