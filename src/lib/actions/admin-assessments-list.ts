"use server";

import { createClient } from "@/lib/supabase/server";
import { verifyAdminOrTrainer } from "@/lib/actions/shared/verify-admin";
import type { PlayerAssessment, AssessmentSectionKey } from "@/types/assessment";
import { ASSESSMENT_SECTIONS } from "@/types/assessment";
import type { Profile } from "@/types/database";
import { applyPositionFilter } from "@/lib/admin/apply-position-filter";

export interface AssessmentQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  ageGroupId?: string;
  position?: string;
  test?: AssessmentSectionKey;
}

async function getUserIdsWithSection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sectionKey: AssessmentSectionKey,
): Promise<string[]> {
  const section = ASSESSMENT_SECTIONS.find((s) => s.key === sectionKey);
  if (!section) return [];
  const orPredicate = section.fields.map((f) => `${f}.not.is.null`).join(",");
  const { data } = await supabase
    .from("player_assessments")
    .select("user_id")
    .is("deleted_at", null)
    .or(orPredicate);
  if (!data) return [];
  return Array.from(new Set(data.map((r) => r.user_id as string)));
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

  // Run independent reads in parallel: test-section user_ids (when set), total
  // assessment count, and the user_id list for the trainees-with-assessments tally.
  // testMatchedIds blocks the profile query, so we want it on the same wave as
  // the counts rather than serialized after them.
  const [testMatchedIds, totalAssessmentsCount, traineesWithAssessmentsData] =
    await Promise.all([
      params.test ? getUserIdsWithSection(supabase, params.test) : Promise.resolve(null),
      supabase
        .from("player_assessments")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("player_assessments")
        .select("user_id")
        .is("deleted_at", null),
    ]);

  if (testMatchedIds && testMatchedIds.length === 0) return empty;
  const totalAssessments = totalAssessmentsCount.count ?? 0;
  const uniqueUsersWithAssessments = new Set(
    traineesWithAssessmentsData.data?.map((a) => a.user_id),
  );

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

  profileQuery = applyPositionFilter(profileQuery, "position", params.position);

  if (testMatchedIds) {
    profileQuery = profileQuery.in("id", testMatchedIds);
  }

  // If age group filter is set, we need to fetch all profiles, filter, then paginate manually
  if (params.ageGroupId) {
    let ageGroupQuery = supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .eq("role", "trainee")
      .is("deleted_at", null)
      .order("full_name")
      .ilike("full_name", params.search ? `%${params.search}%` : "%");

    ageGroupQuery = applyPositionFilter(ageGroupQuery, "position", params.position);

    if (testMatchedIds) {
      ageGroupQuery = ageGroupQuery.in("id", testMatchedIds);
    }

    const { data: allProfiles } = (await ageGroupQuery) as unknown as {
      data: Profile[] | null;
      count: number | null;
    };

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

    return {
      profiles: paginatedProfiles,
      assessmentsByUser,
      total: filtered.length,
      totalAssessments,
      traineesWithAssessments: uniqueUsersWithAssessments.size,
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

  return {
    profiles,
    assessmentsByUser,
    total: totalCount || 0,
    totalAssessments,
    traineesWithAssessments: uniqueUsersWithAssessments.size,
  };
}
