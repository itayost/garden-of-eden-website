import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerAssessment } from "@/types/assessment";
import { chooseAssessmentBadges } from "../utils/choose-assessment-badges";
import { grantBadge } from "./grant-badge";

interface Args {
  /** Set to true when running the one-time backfill (mark all granted badges as already celebrated). */
  preCelebrated?: boolean;
}

export async function grantAssessmentBadges(
  supabase: SupabaseClient,
  newAssessment: PlayerAssessment,
  args: Args = {}
): Promise<void> {
  const userId = newAssessment.user_id;

  const [
    { count: priorCount },
    { data: prevAssessmentRows },
    { data: snapshotRows },
  ] = await Promise.all([
    supabase
      .from("player_assessments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .lt("assessment_date", newAssessment.assessment_date),
    supabase
      .from("player_assessments")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .lt("assessment_date", newAssessment.assessment_date)
      .order("assessment_date", { ascending: false })
      .limit(1),
    supabase
      .from("player_rating_snapshots")
      .select("overall_rating, assessment_id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("assessment_date", { ascending: false })
      .limit(2),
  ]);

  const prevAssessment = (prevAssessmentRows?.[0] ?? null) as PlayerAssessment | null;
  const newSnapshotOverall =
    snapshotRows?.find((r) => r.assessment_id === newAssessment.id)?.overall_rating ?? null;
  const prevSnapshotOverall =
    snapshotRows?.find((r) => r.assessment_id !== newAssessment.id)?.overall_rating ?? null;

  const badges = chooseAssessmentBadges({
    priorAssessmentCount: priorCount ?? 0,
    prevAssessment,
    newAssessment,
    prevSnapshotOverall,
    newSnapshotOverall,
  });

  for (const badge of badges) {
    await grantBadge(supabase, userId, badge, { preCelebrated: args.preCelebrated });
  }
}
