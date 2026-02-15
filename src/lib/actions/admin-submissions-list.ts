"use server";

import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared/verify-admin";
import type {
  PreWorkoutForm,
  PostWorkoutForm,
  NutritionForm,
  TrainerShiftReport,
} from "@/types/database";

type PostWorkoutWithTrainer = PostWorkoutForm & {
  trainers: { name: string } | null;
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
}

export async function getPreWorkoutPaginated(
  params: SubmissionQueryParams
): Promise<PaginatedResult<PreWorkoutForm>> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return { items: [], total: 0 };

  const supabase = await createClient();
  const from = params.page * params.pageSize;

  let query = supabase
    .from("pre_workout_forms")
    .select("*", { count: "exact" })
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

  const supabase = await createClient();
  const from = params.page * params.pageSize;

  let query = supabase
    .from("post_workout_forms")
    .select("*, trainers(name)", { count: "exact" })
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
): Promise<PaginatedResult<NutritionForm>> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return { items: [], total: 0 };

  const supabase = await createClient();
  const from = params.page * params.pageSize;

  let query = supabase
    .from("nutrition_forms")
    .select("*", { count: "exact" })
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

  const { data, count } = (await query.range(
    from,
    from + params.pageSize - 1
  )) as unknown as {
    data: NutritionForm[] | null;
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
