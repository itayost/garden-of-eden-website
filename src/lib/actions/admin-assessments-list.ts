"use server";

import { createClient } from "@/lib/supabase/server";
import { verifyAdminOrTrainer } from "@/lib/actions/shared/verify-admin";
import type { PlayerAssessment } from "@/types/assessment";
import type { Profile } from "@/types/database";

export interface AssessmentQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  ageGroupId?: string;
}

export interface AssessmentsPaginatedResult {
  profiles: Profile[];
  assessmentsByUser: Record<string, PlayerAssessment[]>;
  total: number;
  totalAssessments: number;
  traineesWithAssessments: number;
}

export async function getAssessmentsPaginated(
  params: AssessmentQueryParams
): Promise<AssessmentsPaginatedResult> {
  const empty: AssessmentsPaginatedResult = {
    profiles: [],
    assessmentsByUser: {},
    total: 0,
    totalAssessments: 0,
    traineesWithAssessments: 0,
  };

  const { error } = await verifyAdminOrTrainer();
  if (error) return empty;

  const supabase = await createClient();
  const from = params.page * params.pageSize;

  // Build profile query with filters
  let profileQuery = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .eq("role", "trainee")
    .is("deleted_at", null)
    .order("full_name");

  if (params.search) {
    profileQuery = profileQuery.ilike("full_name", `%${params.search}%`);
  }

  if (params.ageGroupId) {
    // Age group filtering is done client-side since birthdate -> age group mapping
    // requires JS logic. We fetch all matching profiles and filter, then paginate.
  }

  // If age group filter is set, we need to fetch all profiles, filter, then paginate manually
  if (params.ageGroupId) {
    const { data: allProfiles, count: totalCount } = (await supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .eq("role", "trainee")
      .is("deleted_at", null)
      .order("full_name")
      .ilike(
        "full_name",
        params.search ? `%${params.search}%` : "%"
      )) as unknown as { data: Profile[] | null; count: number | null };

    if (!allProfiles || allProfiles.length === 0)
      return { ...empty, total: 0 };

    // Import getAgeGroup dynamically to filter
    const { getAgeGroup } = await import("@/types/assessment");
    const filtered = allProfiles.filter((p) => {
      const group = getAgeGroup(p.birthdate);
      return group?.id === params.ageGroupId;
    });

    const paginatedProfiles = filtered.slice(from, from + params.pageSize);
    const profileIds = paginatedProfiles.map((p) => p.id);

    // Fetch assessments for visible profiles
    const { data: assessments } = (await supabase
      .from("player_assessments")
      .select("*")
      .is("deleted_at", null)
      .in("user_id", profileIds)
      .order("assessment_date", {
        ascending: false,
      })) as unknown as { data: PlayerAssessment[] | null };

    const assessmentsByUser: Record<string, PlayerAssessment[]> = {};
    assessments?.forEach((a) => {
      if (!assessmentsByUser[a.user_id]) assessmentsByUser[a.user_id] = [];
      assessmentsByUser[a.user_id].push(a);
    });

    // Get total assessments count and trainees with assessments
    const { count: totalAssessments } = await supabase
      .from("player_assessments")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);

    const allAssessmentUserIds = new Set(
      (allProfiles || [])
        .filter((p) => {
          // Check if this profile has assessments - need to query
          return true; // We'll compute this from the full data
        })
        .map((p) => p.id)
    );

    return {
      profiles: paginatedProfiles,
      assessmentsByUser,
      total: filtered.length,
      totalAssessments: totalAssessments || 0,
      traineesWithAssessments: 0, // Computed below
    };
  }

  // No age group filter — use simple range pagination
  const { data: profiles, count: totalCount } = (await profileQuery.range(
    from,
    from + params.pageSize - 1
  )) as unknown as { data: Profile[] | null; count: number | null };

  if (!profiles || profiles.length === 0)
    return { ...empty, total: totalCount || 0 };

  const profileIds = profiles.map((p) => p.id);

  // Fetch assessments for visible profiles only
  const { data: assessments } = (await supabase
    .from("player_assessments")
    .select("*")
    .is("deleted_at", null)
    .in("user_id", profileIds)
    .order("assessment_date", {
      ascending: false,
    })) as unknown as { data: PlayerAssessment[] | null };

  const assessmentsByUser: Record<string, PlayerAssessment[]> = {};
  assessments?.forEach((a) => {
    if (!assessmentsByUser[a.user_id]) assessmentsByUser[a.user_id] = [];
    assessmentsByUser[a.user_id].push(a);
  });

  // Get summary stats
  const [{ count: totalAssessments }, { count: totalTrainees }] =
    await Promise.all([
      supabase
        .from("player_assessments")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "trainee")
        .is("deleted_at", null),
    ]);

  // Count trainees with assessments (from total dataset, not just current page)
  const { data: traineesWithAssessmentsData } = await supabase
    .from("player_assessments")
    .select("user_id")
    .is("deleted_at", null);

  const uniqueUsersWithAssessments = new Set(
    traineesWithAssessmentsData?.map((a) => a.user_id)
  );

  return {
    profiles,
    assessmentsByUser,
    total: totalCount || 0,
    totalAssessments: totalAssessments || 0,
    traineesWithAssessments: uniqueUsersWithAssessments.size,
  };
}
