"use server";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { newestFirst, readInChunks } from "@/lib/supabase/in-chunks";
import { verifyAdminOrTrainer } from "@/lib/actions/shared/verify-admin";
import { applyPositionFilter } from "@/lib/admin/apply-position-filter";
import { getBranchScopeAction } from "@/lib/actions/shared/branch-scope";
import { visibleProfileIds } from "@/features/branches/lib/memberships";
import { CATEGORY_COLUMNS } from "@/lib/utils/trainee-notes";
import { SHIFT_REPORT_EXPORT_CAP } from "./admin-submissions-constants";
import type {
  PreWorkoutForm,
  PostWorkoutForm,
  NutritionForm,
  TrainerShiftReport,
} from "@/types/database";

type PostWorkoutWithTrainer = PostWorkoutForm & {
  trainer: { full_name: string } | null;
  profile: { position: string | null } | null;
};

export type NutritionFormWithProfile = NutritionForm & {
  profile: { full_name: string; birthdate: string | null; position: string | null } | null;
};

export type MentalQuestionnaire = {
  id: string;
  user_id: string;
  full_name: string;
  last_session_conclusion: string | null;
  mental_insight: string | null;
  tool_to_take: string | null;
  wants_more_zoom: boolean | null;
  zoom_feeling: string | null;
  wants_one_on_one: boolean | null;
  submitted_at: string;
};

export type MentalQuestionnaireWithProfile = MentalQuestionnaire & {
  profile: { position: string | null } | null;
};

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface SubmissionQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  position?: string;
  branchId?: string;
}

/**
 * User ids the caller may see for these params, or null for no restriction.
 * Cached per request: the submissions page loads every tab at once.
 */
const visibleUserIdsFor = cache(
  async (branchId: string | undefined): Promise<{ ids: string[] | null } | { blocked: true }> => {
    const scopeResult = await getBranchScopeAction();
    if ("error" in scopeResult) return { blocked: true };
    const ids = await visibleProfileIds(createAdminClient(), scopeResult.data.scope, branchId);
    if (ids !== null && ids.length === 0) return { blocked: true };
    return { ids };
  },
);

interface FormList {
  table: "pre_workout_forms" | "post_workout_forms" | "nutrition_forms" | "mental_questionnaires";
  /**
   * The trainee embed, aliased `profile`: the position filter reads it, so it
   * must be `!inner` for the filter to drop forms rather than null the embed.
   */
  profile: string;
  /** Any other embed the tab shows. */
  extra?: string;
  /** The form stores the trainee's name, so the search box matches it. */
  searchable: boolean;
}

/**
 * One page of a form list, newest first. Unrestricted (an admin), the
 * database pages it. A trainer's scope is more trainee ids than one request
 * URL holds, so the ids and times of the matching forms are read a slice of
 * trainees at a time, ordered here, and only the page is fetched whole.
 */
async function formsPage<T>(list: FormList, params: SubmissionQueryParams): Promise<PaginatedResult<T>> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return { items: [], total: 0 };

  const supabase = createAdminClient();
  const from = params.page * params.pageSize;

  const visible = await visibleUserIdsFor(params.branchId);
  if ("blocked" in visible) return { items: [], total: 0 };

  const filtered = (columns: string, options?: { count: "exact" }) => {
    let query = typedFrom(supabase, list.table).select(columns, options);
    if (list.searchable && params.search) {
      query = query.ilike("full_name", `%${params.search}%`);
    }
    if (params.startDate) {
      query = query.gte("submitted_at", params.startDate);
    }
    if (params.endDate) {
      query = query.lte("submitted_at", params.endDate + "T23:59:59");
    }
    return applyPositionFilter(query, "profile.position", params.position);
  };

  const columns = ["*", list.extra, list.profile].filter(Boolean).join(", ");

  if (visible.ids === null) {
    const { data, count } = (await filtered(columns, { count: "exact" })
      .order("submitted_at", { ascending: false })
      .range(from, from + params.pageSize - 1)) as { data: T[] | null; count: number | null };
    return { items: data || [], total: count || 0 };
  }

  const { data: keys, error: keysError } = await readInChunks<{ id: string; submitted_at: string | null }>(
    visible.ids,
    "user_id",
    () => filtered(`id, submitted_at, ${list.profile}`).order("id"),
  );
  if (keysError) {
    console.error(`${list.table} page error:`, keysError);
    return { items: [], total: 0 };
  }

  const pageIds = [...keys]
    .sort(newestFirst("submitted_at"))
    .slice(from, from + params.pageSize)
    .map((key) => key.id);
  if (pageIds.length === 0) return { items: [], total: keys.length };

  const { data, error: pageError } = (await filtered(columns).in("id", pageIds)) as {
    data: (T & { id: string })[] | null;
    error: { message: string } | null;
  };
  if (pageError) {
    console.error(`${list.table} page error:`, pageError);
    return { items: [], total: 0 };
  }
  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  return { items: pageIds.flatMap((id) => byId.get(id) ?? []), total: keys.length };
}

export async function getPreWorkoutPaginated(
  params: SubmissionQueryParams
): Promise<PaginatedResult<PreWorkoutForm>> {
  return formsPage<PreWorkoutForm>(
    {
      table: "pre_workout_forms",
      profile: "profile:profiles!inner(position)",
      searchable: true,
    },
    params,
  );
}

export async function getPostWorkoutPaginated(
  params: SubmissionQueryParams
): Promise<PaginatedResult<PostWorkoutWithTrainer>> {
  return formsPage<PostWorkoutWithTrainer>(
    {
      table: "post_workout_forms",
      profile: "profile:profiles!post_workout_forms_user_id_fkey!inner(position)",
      extra: "trainer:profiles!post_workout_forms_trainer_id_fkey(full_name)",
      searchable: true,
    },
    params,
  );
}

export async function getNutritionPaginated(
  params: SubmissionQueryParams
): Promise<PaginatedResult<NutritionFormWithProfile>> {
  return formsPage<NutritionFormWithProfile>(
    {
      table: "nutrition_forms",
      profile: "profile:profiles!nutrition_forms_user_id_fkey!inner(full_name, birthdate, position)",
      searchable: false,
    },
    params,
  );
}

export async function getMentalPaginated(
  params: SubmissionQueryParams
): Promise<PaginatedResult<MentalQuestionnaireWithProfile>> {
  return formsPage<MentalQuestionnaireWithProfile>(
    {
      table: "mental_questionnaires",
      profile: "profile:profiles!inner(position)",
      searchable: true,
    },
    params,
  );
}

export async function getShiftReportsPaginated(
  params: SubmissionQueryParams
): Promise<PaginatedResult<TrainerShiftReport>> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return { items: [], total: 0 };

  const supabase = await createClient();
  const from = params.page * params.pageSize;

  let query = typedFrom(supabase, "trainer_shift_reports")
    .select("*", { count: "exact" })
    .order("report_date", { ascending: false });

  if (params.search) {
    query = query.ilike("trainer_name", `%${params.search}%`);
  }
  if (params.startDate) {
    query = query.gte("report_date", params.startDate);
  }
  if (params.endDate) {
    query = query.lte("report_date", params.endDate);
  }

  const { data, count } = (await query.range(
    from,
    from + params.pageSize - 1
  )) as unknown as {
    data: TrainerShiftReport[] | null;
    count: number | null;
  };

  return { items: data || [], total: count || 0 };
}

export type ShiftReportFilter = Pick<
  SubmissionQueryParams,
  "search" | "startDate" | "endDate"
>;

export async function getAllShiftReportsForExport(
  filters: ShiftReportFilter
): Promise<{ items: TrainerShiftReport[]; truncated: boolean }> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return { items: [], truncated: false };

  const supabase = await createClient();

  let query = typedFrom(supabase, "trainer_shift_reports")
    .select("*")
    .order("report_date", { ascending: false });

  if (filters.search) {
    query = query.ilike("trainer_name", `%${filters.search}%`);
  }
  if (filters.startDate) {
    query = query.gte("report_date", filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte("report_date", filters.endDate);
  }

  const { data } = (await query.range(0, SHIFT_REPORT_EXPORT_CAP - 1)) as unknown as {
    data: TrainerShiftReport[] | null;
  };

  const items = data || [];
  return { items, truncated: items.length >= SHIFT_REPORT_EXPORT_CAP };
}

/** Resolve trainee UUIDs to names for CSV export */
export async function resolveTraineeNamesForExport(
  reports: TrainerShiftReport[]
): Promise<Record<string, string>> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return {};

  const allIds = new Set<string>();

  for (const report of reports) {
    for (const col of CATEGORY_COLUMNS) {
      const ids = report[col.traineeIdsKey] as string[] | null | undefined;
      if (ids) {
        for (const id of ids) allIds.add(id);
      }
      const perTrainee = report[col.perTraineeKey] as Record<string, unknown> | null;
      if (perTrainee) {
        for (const id of Object.keys(perTrainee)) allIds.add(id);
      }
    }
  }

  if (allIds.size === 0) return {};

  // Service-role client: trainers (gated above by verifyAdminOrTrainer) cannot read
  // trainee profiles under RLS, so a session client would yield no names for them.
  // Reads only id + full_name for trainees referenced in the authorized reports.
  const supabase = createAdminClient();
  const { data: trainees } = (await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", Array.from(allIds))) as unknown as {
    data: { id: string; full_name: string | null }[] | null;
  };

  const map: Record<string, string> = {};
  if (trainees) {
    for (const t of trainees) {
      map[t.id] = t.full_name || "ללא שם";
    }
  }
  return map;
}

/** Get total counts for all submission types (for tab headers) */
export async function getSubmissionCounts(): Promise<{
  preWorkout: number;
  postWorkout: number;
  nutrition: number;
  shiftReports: number;
  mental: number;
}> {
  const { error } = await verifyAdminOrTrainer();
  if (error)
    return { preWorkout: 0, postWorkout: 0, nutrition: 0, shiftReports: 0, mental: 0 };

  const supabase = await createClient();

  const [
    { count: preWorkout },
    { count: postWorkout },
    { count: nutrition },
    { count: shiftReports },
    { count: mental },
  ] = await Promise.all([
    supabase
      .from("pre_workout_forms")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("post_workout_forms")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("nutrition_forms")
      .select("*", { count: "exact", head: true }),
    typedFrom(supabase, "trainer_shift_reports").select("*", {
      count: "exact",
      head: true,
    }),
    typedFrom(supabase, "mental_questionnaires").select("*", {
      count: "exact",
      head: true,
    }),
  ]);

  return {
    preWorkout: preWorkout || 0,
    postWorkout: postWorkout || 0,
    nutrition: nutrition || 0,
    shiftReports: shiftReports || 0,
    mental: mental || 0,
  };
}
