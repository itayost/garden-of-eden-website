"use server";

import { createClient } from "@/lib/supabase/server";
import { verifyAdminOrTrainer } from "@/lib/actions/shared/verify-admin";
import type { PlayerAssessment, AssessmentSectionKey } from "@/types/assessment";
import { ASSESSMENT_SECTIONS } from "@/types/assessment";
import type { Profile } from "@/types/database";
import { applyPositionFilter } from "@/lib/admin/apply-position-filter";
import { getBranchScopeAction } from "@/lib/actions/shared/branch-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { byFullName, readInChunks } from "@/lib/supabase/in-chunks";
import { visibleProfileIds } from "@/features/branches/lib/memberships";
import { resolveAgeGroup } from "@/lib/age-group-override";

export interface AssessmentQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  ageGroupId?: string;
  position?: string;
  test?: AssessmentSectionKey;
  branchId?: string;
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

  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return empty;
  const visibleIds = await visibleProfileIds(
    createAdminClient(),
    scopeResult.data.scope,
    params.branchId,
  );
  if (visibleIds !== null && visibleIds.length === 0) return empty;

  const supabase = await createClient();

  // Run independent reads in parallel: test-section user_ids (when set) and
  // the assessment totals. testMatchedIds blocks the profile query, so we want
  // it on the same wave as the counts rather than serialized after them.
  const [testMatchedIds, totals] = await Promise.all([
    params.test ? getUserIdsWithSection(supabase, params.test) : Promise.resolve(null),
    assessmentTotals(supabase, visibleIds),
  ]);

  if (testMatchedIds && testMatchedIds.length === 0) return empty;
  const allowedIds = intersectIds(visibleIds, testMatchedIds);
  if (allowedIds !== null && allowedIds.length === 0) return empty;

  const { profiles, total } = await loadProfilePage(supabase, params, allowedIds);
  if (profiles.length === 0) return { ...empty, total };

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
    total,
    ...totals,
  };
}

/**
 * One page of trainees by name. Unrestricted and without an age group, the
 * database pages it. Otherwise it is filtered and paged here: an age group is
 * worked out in JS, and a trainer's scope is more ids than one request URL
 * holds, so it is read a slice at a time.
 */
async function loadProfilePage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: AssessmentQueryParams,
  allowedIds: string[] | null,
): Promise<{ profiles: Profile[]; total: number }> {
  const from = params.page * params.pageSize;
  const profileQuery = (options?: { count: "exact" }) => {
    const query = supabase
      .from("profiles")
      .select("*", options)
      .eq("role", "trainee")
      .is("deleted_at", null);
    return applyPositionFilter(
      params.search ? query.ilike("full_name", `%${params.search}%`) : query,
      "position",
      params.position,
    );
  };

  if (allowedIds === null && !params.ageGroupId) {
    const { data, count } = (await profileQuery({ count: "exact" })
      .order("full_name")
      .range(from, from + params.pageSize - 1)) as unknown as {
      data: Profile[] | null;
      count: number | null;
    };
    return { profiles: data ?? [], total: count ?? 0 };
  }

  const { data } = await readInChunks(allowedIds, "id", () => profileQuery().order("id"));
  const matched = (data as Profile[])
    .filter((p) => !params.ageGroupId || resolveAgeGroup(p)?.id === params.ageGroupId)
    .sort(byFullName);
  return { profiles: matched.slice(from, from + params.pageSize), total: matched.length };
}

/** Ids in both lists; a null list allows any id. */
function intersectIds(a: string[] | null, b: string[] | null): string[] | null {
  if (a === null) return b;
  if (b === null) return a;
  const inB = new Set(b);
  return a.filter((id) => inB.has(id));
}

/**
 * How many assessments the caller may see and how many trainees they cover,
 * from one read of their user ids. A trainer's scope is read a slice of ids
 * at a time.
 */
async function assessmentTotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  visibleIds: string[] | null,
): Promise<{ totalAssessments: number; traineesWithAssessments: number }> {
  const { data } = await readInChunks(visibleIds, "user_id", () =>
    supabase.from("player_assessments").select("user_id").is("deleted_at", null).order("id"),
  );
  return {
    totalAssessments: data.length,
    traineesWithAssessments: new Set(data.map((a) => a.user_id)).size,
  };
}
