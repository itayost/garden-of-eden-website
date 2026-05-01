"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared/verify-admin";
import { applyPositionFilter } from "@/lib/admin/apply-position-filter";
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
}

export async function getPreWorkoutPaginated(
  params: SubmissionQueryParams
): Promise<PaginatedResult<PreWorkoutForm>> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return { items: [], total: 0 };

  const supabase = createAdminClient();
  const from = params.page * params.pageSize;

  let query = supabase
    .from("pre_workout_forms")
    .select("*, profile:profiles!inner(position)", { count: "exact" })
    .order("submitted_at", { ascending: false });

  if (params.search) {
    query = query.ilike("full_name", `%${params.search}%`);
  }
  if (params.startDate) {
    query = query.gte("submitted_at", params.startDate);
  }
  if (params.endDate) {
    query = query.lte("submitted_at", params.endDate + "T23:59:59");
  }
  query = applyPositionFilter(query, "profile.position", params.position);

  const { data, count } = (await query.range(
    from,
    from + params.pageSize - 1
  )) as unknown as {
    data: PreWorkoutForm[] | null;
    count: number | null;
  };

  return { items: data || [], total: count || 0 };
}

export async function getPostWorkoutPaginated(
  params: SubmissionQueryParams
): Promise<PaginatedResult<PostWorkoutWithTrainer>> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return { items: [], total: 0 };

  const supabase = createAdminClient();
  const from = params.page * params.pageSize;

  let query = supabase
    .from("post_workout_forms")
    .select("*, trainer:profiles!post_workout_forms_trainer_id_fkey(full_name), profile:profiles!inner(position)", { count: "exact" })
    .order("submitted_at", { ascending: false });

  if (params.search) {
    query = query.ilike("full_name", `%${params.search}%`);
  }
  if (params.startDate) {
    query = query.gte("submitted_at", params.startDate);
  }
  if (params.endDate) {
    query = query.lte("submitted_at", params.endDate + "T23:59:59");
  }
  query = applyPositionFilter(query, "profile.position", params.position);

  const { data, count } = (await query.range(
    from,
    from + params.pageSize - 1
  )) as unknown as {
    data: PostWorkoutWithTrainer[] | null;
    count: number | null;
  };

  return { items: data || [], total: count || 0 };
}

export async function getNutritionPaginated(
  params: SubmissionQueryParams
): Promise<PaginatedResult<NutritionFormWithProfile>> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return { items: [], total: 0 };

  const supabase = createAdminClient();
  const from = params.page * params.pageSize;

  let query = supabase
    .from("nutrition_forms")
    .select("*, profile:profiles!nutrition_forms_user_id_fkey(full_name, birthdate, position)", { count: "exact" })
    .order("submitted_at", { ascending: false });

  if (params.startDate) {
    query = query.gte("submitted_at", params.startDate);
  }
  if (params.endDate) {
    query = query.lte("submitted_at", params.endDate + "T23:59:59");
  }
  query = applyPositionFilter(query, "profile.position", params.position);

  const { data, count } = (await query.range(
    from,
    from + params.pageSize - 1
  )) as unknown as {
    data: NutritionFormWithProfile[] | null;
    count: number | null;
  };

  return { items: data || [], total: count || 0 };
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

  const supabase = await createClient();
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
}> {
  const { error } = await verifyAdminOrTrainer();
  if (error)
    return { preWorkout: 0, postWorkout: 0, nutrition: 0, shiftReports: 0 };

  const supabase = await createClient();

  const [
    { count: preWorkout },
    { count: postWorkout },
    { count: nutrition },
    { count: shiftReports },
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
  ]);

  return {
    preWorkout: preWorkout || 0,
    postWorkout: postWorkout || 0,
    nutrition: nutrition || 0,
    shiftReports: shiftReports || 0,
  };
}
