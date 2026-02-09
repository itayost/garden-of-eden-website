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

/**
 * Calculate FIFA-style card ratings for a user based on their assessments
 * and age-group percentile comparison.
 *
 * Returns null if the user has no assessments.
 */
export async function calculateUserRatings(
  userId: string,
  assessments: PlayerAssessment[],
  birthdate: string | null,
  supabase: SupabaseClient
): Promise<UserRatings | null> {
  if (!assessments || assessments.length === 0) {
    return null;
  }

  const latestAssessment = assessments[assessments.length - 1];
  const ageGroup = getAgeGroup(birthdate);
  let groupAssessments: PlayerAssessment[] = [];
  let calculatedRatings: CalculatedRatings | null = null;

  if (ageGroup) {
    // Fetch all trainee profiles to find those in the same age group
    const { data: ageGroupProfiles } = (await supabase
      .from("profiles")
      .select("id, birthdate")
      .eq("role", "trainee")) as unknown as {
      data: { id: string; birthdate: string | null }[] | null;
    };

    const sameAgeGroupIds =
      ageGroupProfiles
        ?.filter((p) => {
          const pAgeGroup = getAgeGroup(p.birthdate);
          return pAgeGroup?.id === ageGroup.id;
        })
        .map((p) => p.id) || [];

    if (sameAgeGroupIds.length > 0) {
      const { data: fetchedGroupAssessments } = await supabase
        .from("player_assessments")
        .select("*")
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
