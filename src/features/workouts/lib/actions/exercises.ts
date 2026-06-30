"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { exerciseSchema } from "@/lib/validations/workout-exercise";
import type { ExerciseInput } from "@/lib/validations/workout-exercise";
import type { WorkoutExercise, ExerciseFilters } from "@/features/workouts/lib/types";

export type { ExerciseInput } from "@/lib/validations/workout-exercise";
import { deriveSubCategories } from "@/features/workouts/lib/grid-utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;
const REVALIDATE_PATH = "/admin/workouts/exercises";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyToNull = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
};

// ---------------------------------------------------------------------------
// Action result type
// ---------------------------------------------------------------------------

type ActionResult =
  | { success: true; exerciseId?: string }
  | { error: string; fieldErrors?: Record<string, string[]> };

// ---------------------------------------------------------------------------
// Raw DB shape (snake_case)
// ---------------------------------------------------------------------------

interface RawWorkoutExercise {
  id: string;
  main_category: string;
  sub_category: string | null;
  name_he: string | null;
  name_en: string | null;
  equipment: string | null;
  cues_he: string | null;
  goal_he: string | null;
  order_index: number;
}

// ---------------------------------------------------------------------------
// Mapper: snake_case DB row -> camelCase WorkoutExercise
// ---------------------------------------------------------------------------

function mapExercise(raw: RawWorkoutExercise): WorkoutExercise {
  return {
    id: raw.id,
    mainCategory: raw.main_category,
    subCategory: raw.sub_category,
    nameHe: raw.name_he,
    nameEn: raw.name_en,
    equipment: raw.equipment,
    cuesHe: raw.cues_he,
    goalHe: raw.goal_he,
    orderIndex: raw.order_index,
  };
}

// ---------------------------------------------------------------------------
// listExercises
// ---------------------------------------------------------------------------

export async function listExercises(
  filters: ExerciseFilters,
  page: number
): Promise<{ rows: WorkoutExercise[]; total: number }> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { rows: [], total: 0 };

  const adminClient = createAdminClient();

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = typedFrom(adminClient, "workout_exercises")
    .select("id, main_category, sub_category, name_he, name_en, equipment, cues_he, goal_he, order_index", {
      count: "exact",
    })
    .order("order_index")
    .range(from, to);

  if (filters.mainCategory) {
    query = query.eq("main_category", filters.mainCategory);
  }

  if (filters.subCategory) {
    query = query.eq("sub_category", filters.subCategory);
  }

  if (filters.search) {
    const term = filters.search.trim();
    if (term) {
      query = query.or(
        `name_he.ilike.%${term}%,name_en.ilike.%${term}%,equipment.ilike.%${term}%`
      );
    }
  }

  const { data, count, error } = (await query) as {
    data: RawWorkoutExercise[] | null;
    count: number | null;
    error: unknown;
  };

  if (error) {
    console.error("listExercises query error:", error);
    return { rows: [], total: 0 };
  }

  const rows = (data ?? []).map(mapExercise);
  return { rows, total: count ?? 0 };
}

// ---------------------------------------------------------------------------
// createExercise
// ---------------------------------------------------------------------------

export async function createExercise(input: ExerciseInput): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = exerciseSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const adminClient = createAdminClient();

  try {
    const { data: maxOrder } = (await typedFrom(adminClient, "workout_exercises")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: { order_index: number } | null };

    const orderIndex = (maxOrder?.order_index ?? 0) + 1;

    const { data: created, error: insertError } = (await typedFrom(
      adminClient,
      "workout_exercises"
    )
      .insert({
        main_category: validated.data.main_category,
        sub_category: emptyToNull(validated.data.sub_category),
        name_he: emptyToNull(validated.data.name_he),
        name_en: emptyToNull(validated.data.name_en),
        equipment: emptyToNull(validated.data.equipment),
        cues_he: emptyToNull(validated.data.cues_he),
        goal_he: emptyToNull(validated.data.goal_he),
        order_index: orderIndex,
      })
      .select("id")
      .single()) as { data: { id: string } | null; error: unknown };

    if (insertError || !created) {
      console.error("createExercise insert error:", insertError);
      return { error: "שגיאה ביצירת תרגיל" };
    }

    revalidatePath(REVALIDATE_PATH);
    return { success: true, exerciseId: created.id };
  } catch (err) {
    console.error("createExercise error:", err);
    return { error: "שגיאה ביצירת תרגיל" };
  }
}

// ---------------------------------------------------------------------------
// updateExercise
// ---------------------------------------------------------------------------

export async function updateExercise(
  id: string,
  input: ExerciseInput
): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה תרגיל לא תקין" };

  const validated = exerciseSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const adminClient = createAdminClient();

  try {
    const { error: updateError } = await typedFrom(adminClient, "workout_exercises")
      .update({
        main_category: validated.data.main_category,
        sub_category: emptyToNull(validated.data.sub_category),
        name_he: emptyToNull(validated.data.name_he),
        name_en: emptyToNull(validated.data.name_en),
        equipment: emptyToNull(validated.data.equipment),
        cues_he: emptyToNull(validated.data.cues_he),
        goal_he: emptyToNull(validated.data.goal_he),
      })
      .eq("id", id);

    if (updateError) {
      console.error("updateExercise error:", updateError);
      return { error: "שגיאה בעדכון תרגיל" };
    }

    revalidatePath(REVALIDATE_PATH);
    return { success: true, exerciseId: id };
  } catch (err) {
    console.error("updateExercise error:", err);
    return { error: "שגיאה בעדכון תרגיל" };
  }
}

// ---------------------------------------------------------------------------
// listSubCategories
// ---------------------------------------------------------------------------

export async function listSubCategories(mainCategory?: string): Promise<string[]> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return [];

  const adminClient = createAdminClient();

  let query = typedFrom(adminClient, "workout_exercises")
    .select("main_category, sub_category")
    .not("sub_category", "is", null);

  if (mainCategory) {
    query = query.eq("main_category", mainCategory);
  }

  const { data, error } = (await query) as {
    data: Pick<RawWorkoutExercise, "main_category" | "sub_category">[] | null;
    error: unknown;
  };

  if (error) {
    console.error("listSubCategories query error:", error);
    return [];
  }

  const mapped = (data ?? []).map((r) => ({
    mainCategory: r.main_category,
    subCategory: r.sub_category,
  }));

  return deriveSubCategories(mapped, mainCategory);
}

// ---------------------------------------------------------------------------
// deleteExercise
// ---------------------------------------------------------------------------

export async function deleteExercise(id: string): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה תרגיל לא תקין" };

  const adminClient = createAdminClient();

  try {
    const { error: deleteError } = await typedFrom(adminClient, "workout_exercises")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("deleteExercise error:", deleteError);
      return { error: "שגיאה במחיקת תרגיל" };
    }

    revalidatePath(REVALIDATE_PATH);
    return { success: true };
  } catch (err) {
    console.error("deleteExercise error:", err);
    return { error: "שגיאה במחיקת תרגיל" };
  }
}
