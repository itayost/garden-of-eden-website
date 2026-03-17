"use server";

import { createClient } from "@/lib/supabase/server";
import { verifyAdminOrTrainer } from "@/lib/actions/shared/verify-admin";
import {
  getAgeGroup,
  getAssessmentCompleteness,
  computeSectionCompleteness,
} from "@/types/assessment";
import type { PlayerAssessment, AssessmentMonthStatus, SectionCompleteness } from "@/types/assessment";
import type { Profile } from "@/types/database";

export interface AssessmentMonthParams {
  month: number;      // 1–12
  year: number;
  search?: string;
  ageGroupId?: string;
  statusFilter?: AssessmentMonthStatus | 'all';
  page: number;       // 0-based: page 0 = first page
  pageSize: number;
}

export interface AssessmentMonthResult {
  profiles: Profile[];
  assessmentByUser: Record<string, PlayerAssessment | null>;
  statusByUser: Record<string, AssessmentMonthStatus>;
  sectionsByUser: Record<string, SectionCompleteness[]>;
  total: number;
  fullCount: number;
  partialCount: number;
  noneCount: number;
  error?: boolean;
}

const empty: AssessmentMonthResult = {
  profiles: [],
  assessmentByUser: {},
  statusByUser: {},
  sectionsByUser: {},
  total: 0,
  fullCount: 0,
  partialCount: 0,
  noneCount: 0,
};

export async function getAssessmentsByMonth(
  params: AssessmentMonthParams
): Promise<AssessmentMonthResult> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return empty;

  // Validate inputs
  if (params.month < 1 || params.month > 12 || params.year < 2000 || params.year > 2100) {
    return empty;
  }

  try {
    const supabase = await createClient();

    // Date range: first day → last day of selected month (ISO date strings)
    const firstDay = new Date(params.year, params.month - 1, 1)
      .toISOString()
      .split('T')[0];
    const lastDay = new Date(params.year, params.month, 0)
      .toISOString()
      .split('T')[0];

    // Fetch all trainees (no pagination — ~75 records)
    let profileQuery = supabase
      .from("profiles")
      .select("*")
      .eq("role", "trainee")
      .is("deleted_at", null)
      .order("full_name");

    if (params.search) {
      profileQuery = profileQuery.ilike("full_name", `%${params.search}%`);
    }

    const { data: allProfiles } = (await profileQuery) as unknown as {
      data: Profile[] | null;
    };

    if (!allProfiles || allProfiles.length === 0) return empty;

    // Age-group filtering in JS (same pattern as getAssessmentsPaginated)
    const filteredProfiles = params.ageGroupId
      ? allProfiles.filter((p) => getAgeGroup(p.birthdate)?.id === params.ageGroupId)
      : allProfiles;

    if (filteredProfiles.length === 0) return empty;

    // Fetch all assessments in the date range for these trainees
    const profileIds = filteredProfiles.map((p) => p.id);
    const { data: assessments } = (await supabase
      .from("player_assessments")
      .select("*")
      .gte("assessment_date", firstDay)
      .lte("assessment_date", lastDay)
      .is("deleted_at", null)
      .in("user_id", profileIds)
      .order("assessment_date", { ascending: false })) as unknown as {
      data: PlayerAssessment[] | null;
    };

    // Index most-recent assessment per user (already ordered desc)
    const latestByUser: Record<string, PlayerAssessment> = {};
    (assessments ?? []).forEach((a) => {
      if (!latestByUser[a.user_id]) {
        latestByUser[a.user_id] = a;
      }
    });

    // Compute status and sections for each trainee
    const assessmentByUser: Record<string, PlayerAssessment | null> = {};
    const statusByUser: Record<string, AssessmentMonthStatus> = {};
    const sectionsByUser: Record<string, SectionCompleteness[]> = {};

    let fullCount = 0;
    let partialCount = 0;
    let noneCount = 0;

    for (const profile of filteredProfiles) {
      const assessment = latestByUser[profile.id] ?? null;
      assessmentByUser[profile.id] = assessment;

      let status: AssessmentMonthStatus;
      if (!assessment) {
        status = 'none';
        noneCount++;
        sectionsByUser[profile.id] = [];
      } else if (getAssessmentCompleteness(assessment) === 100) {
        status = 'full';
        fullCount++;
        sectionsByUser[profile.id] = computeSectionCompleteness(assessment);
      } else {
        status = 'partial';
        partialCount++;
        sectionsByUser[profile.id] = computeSectionCompleteness(assessment);
      }

      statusByUser[profile.id] = status;
    }

    // Apply status filter (counts are already computed above, before filtering)
    const statusFilter = params.statusFilter && params.statusFilter !== 'all'
      ? params.statusFilter
      : null;

    const filteredByStatus = statusFilter
      ? filteredProfiles.filter((p) => statusByUser[p.id] === statusFilter)
      : filteredProfiles;

    // Paginate
    const from = params.page * params.pageSize;
    const paginatedProfiles = filteredByStatus.slice(from, from + params.pageSize);

    return {
      profiles: paginatedProfiles,
      assessmentByUser,
      statusByUser,
      sectionsByUser,
      total: filteredByStatus.length,
      fullCount,
      partialCount,
      noneCount,
    };
  } catch {
    return { ...empty, error: true };
  }
}
