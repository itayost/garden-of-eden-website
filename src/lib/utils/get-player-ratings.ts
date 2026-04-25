import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalculatedRatings } from "@/lib/assessment-to-rating";
import { calculateNeutralRatings } from "@/lib/assessment-to-rating";

export interface PlayerRatingsResult {
  readonly ratings: CalculatedRatings;
}

export interface RatingHistoryRow {
  date: string;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physical: number | null;
  overall_rating: number | null;
}

/**
 * Trainee's CURRENT ratings = the most recent rating snapshot.
 *
 * Snapshots are computed at assessment write time by recordAssessment().
 * The orphan-catching cron at /api/cron/backfill-rating-snapshots ensures
 * any assessment with no snapshot is caught within 24 hours.
 *
 * Returns neutral (all-null) ratings if the trainee has no snapshot yet.
 */
export async function getPlayerRatings(
  supabase: SupabaseClient,
  userId: string
): Promise<PlayerRatingsResult> {
  const { data, error } = await supabase
    .from("player_rating_snapshots")
    .select("pace, shooting, passing, dribbling, defending, physical, overall_rating")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("assessment_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { ratings: calculateNeutralRatings() };
  }
  return { ratings: data as CalculatedRatings };
}

/**
 * Full rating history for the chart, in date-ascending order.
 * Returns an empty array if no snapshots exist for this user.
 */
export async function getPlayerRatingHistory(
  supabase: SupabaseClient,
  userId: string
): Promise<RatingHistoryRow[]> {
  const { data, error } = await supabase
    .from("player_rating_snapshots")
    .select(
      "assessment_date, pace, shooting, passing, dribbling, defending, physical, overall_rating"
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("assessment_date", { ascending: true });

  if (error || !data) return [];

  return (data as Array<{
    assessment_date: string;
    pace: number | null;
    shooting: number | null;
    passing: number | null;
    dribbling: number | null;
    defending: number | null;
    physical: number | null;
    overall_rating: number | null;
  }>).map((r) => ({
    date: r.assessment_date,
    pace: r.pace,
    shooting: r.shooting,
    passing: r.passing,
    dribbling: r.dribbling,
    defending: r.defending,
    physical: r.physical,
    overall_rating: r.overall_rating,
  }));
}
