"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { exerciseSchema } from "@/lib/validations/workout-exercise";
import type {
  ExerciseInput,
  ExerciseParsed,
} from "@/lib/validations/workout-exercise";
import {
  UNLINKED_EQUIPMENT_FILTER,
  type WorkoutExercise,
  type ExerciseFilters,
} from "@/features/workouts/lib/types";
import {
  EQUIPMENT_PROFILE_COLUMNS,
  type EquipmentProfile,
} from "@/types/equipment";

export type { ExerciseInput } from "@/lib/validations/workout-exercise";
import {
  deriveMainCategories,
  deriveSubCategories,
  normalizeCategoryName,
} from "@/features/workouts/lib/grid-utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;
/** Below this, a machine-name lookup matches too much to be worth a query. */
const MIN_EQUIPMENT_SEARCH_LENGTH = 2;
const REVALIDATE_PATH = "/admin/workouts/exercises";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyToNull = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
};

/** The five nullable override columns, straight off a parsed exercise. */
function defaultOverrides(data: ExerciseParsed) {
  return {
    default_sets: data.default_sets,
    default_reps: data.default_reps,
    default_weight_kg: data.default_weight_kg,
    default_duration_seconds: data.default_duration_seconds,
    default_distance_m: data.default_distance_m,
  };
}

/**
 * Equipment ids whose Hebrew name matches the search term. Used to widen the
 * exercise search across the FK without an inner join.
 */
async function findEquipmentIdsByName(
  adminClient: ReturnType<typeof createAdminClient>,
  term: string,
): Promise<string[]> {
  const { data, error } = (await typedFrom(adminClient, "equipment")
    .select("id")
    .ilike("name_he", `%${term}%`)
    .limit(200)) as { data: { id: string }[] | null; error: unknown };

  if (error) {
    console.error("findEquipmentIdsByName error:", error);
    return [];
  }

  return (data ?? []).map((row) => row.id).filter(isValidUUID);
}

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
  equipment_id: string | null;
  cues_he: string | null;
  goal_he: string | null;
  order_index: number;
  default_sets: number | null;
  default_reps: number | null;
  default_weight_kg: number | null;
  default_duration_seconds: number | null;
  default_distance_m: number | null;
  /** Embedded catalog row: the real link, plus the full profile. */
  equipment_ref?: (EquipmentProfile & { code: string }) | null;
}

/**
 * Columns the library reads.
 *
 * The `equipment_ref` embed does double duty: it lets the table show the
 * linked machine instead of the legacy free-text label, and it carries the
 * full profile so the session builder can seed a row's targets without a
 * second round trip per exercise added.
 */
const EXERCISE_SELECT = `id, main_category, sub_category, name_he, name_en, equipment, equipment_id, cues_he, goal_he, order_index, default_sets, default_reps, default_weight_kg, default_duration_seconds, default_distance_m, equipment_ref:equipment(code, ${EQUIPMENT_PROFILE_COLUMNS})`;

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
    equipmentId: raw.equipment_id,
    equipmentName: raw.equipment_ref?.name_he ?? null,
    equipmentCode: raw.equipment_ref?.code ?? null,
    equipmentProfile: raw.equipment_ref ?? null,
    defaultSets: raw.default_sets,
    defaultReps: raw.default_reps,
    defaultWeightKg: raw.default_weight_kg,
    defaultDurationSeconds: raw.default_duration_seconds,
    defaultDistanceM: raw.default_distance_m,
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
    .select(EXERCISE_SELECT, { count: "exact" })
    .order("order_index")
    .range(from, to);

  if (filters.mainCategory) {
    query = query.eq("main_category", filters.mainCategory);
  }

  if (filters.subCategory) {
    query = query.eq("sub_category", filters.subCategory);
  }

  // "Which exercises run on this machine" — the target of the count badge on
  // the equipment catalog. UNLINKED_EQUIPMENT_FILTER inverts it, which is the
  // more useful view: rows that can never match a QR scan.
  if (filters.equipmentId === UNLINKED_EQUIPMENT_FILTER) {
    query = query.is("equipment_id", null);
  } else if (filters.equipmentId && isValidUUID(filters.equipmentId)) {
    query = query.eq("equipment_id", filters.equipmentId);
  }

  if (filters.search) {
    // Strip characters that would break the PostgREST `.or()` filter grammar
    // (`,` separates clauses, `()` groups) or act as LIKE wildcards (`%` `_`),
    // so a search like "chest (cable)" can't corrupt the query into a parse
    // error that silently returns zero rows.
    const term = filters.search.replace(/[,()%_*\\]/g, " ").trim();
    if (term) {
      const clauses = [
        `name_he.ilike.%${term}%`,
        `name_en.ilike.%${term}%`,
        `equipment.ilike.%${term}%`,
      ];

      // Searching a machine name must find the exercises on it, even when
      // nobody typed anything into the legacy free-text column. A filter on
      // the embed would narrow the embed, not the parent rows, and an inner
      // join would drop every unlinked exercise — so resolve the ids first.
      // Gated on 2+ characters: one-letter terms match most of the catalog
      // and would double every keystroke's cost for nothing.
      if (term.length >= MIN_EQUIPMENT_SEARCH_LENGTH) {
        const matchingIds = await findEquipmentIdsByName(adminClient, term);
        if (matchingIds.length > 0) {
          clauses.push(`equipment_id.in.(${matchingIds.join(",")})`);
        }
      }

      query = query.or(clauses.join(","));
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
        main_category: normalizeCategoryName(validated.data.main_category),
        sub_category: emptyToNull(validated.data.sub_category),
        name_he: emptyToNull(validated.data.name_he),
        name_en: emptyToNull(validated.data.name_en),
        equipment: emptyToNull(validated.data.equipment),
        equipment_id: validated.data.equipment_id ?? null,
        cues_he: emptyToNull(validated.data.cues_he),
        goal_he: emptyToNull(validated.data.goal_he),
        ...defaultOverrides(validated.data),
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
        main_category: normalizeCategoryName(validated.data.main_category),
        sub_category: emptyToNull(validated.data.sub_category),
        name_he: emptyToNull(validated.data.name_he),
        name_en: emptyToNull(validated.data.name_en),
        equipment: emptyToNull(validated.data.equipment),
        equipment_id: validated.data.equipment_id ?? null,
        cues_he: emptyToNull(validated.data.cues_he),
        goal_he: emptyToNull(validated.data.goal_he),
        ...defaultOverrides(validated.data),
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
// listMainCategories
// ---------------------------------------------------------------------------

/**
 * The categories actually in use. The column is free text, so the list belongs
 * to the data rather than to a const that only a deploy can change.
 */
export async function listMainCategories(): Promise<string[]> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return [];

  const adminClient = createAdminClient();

  const { data, error } = (await typedFrom(adminClient, "workout_exercises").select(
    "main_category",
  )) as { data: Pick<RawWorkoutExercise, "main_category">[] | null; error: unknown };

  if (error) {
    console.error("listMainCategories query error:", error);
    return [];
  }

  return deriveMainCategories((data ?? []).map((r) => ({ mainCategory: r.main_category })));
}

// ---------------------------------------------------------------------------
// countUnlinkedExercises
// ---------------------------------------------------------------------------

/** How many exercises no QR scan can reach. Drives the library's banner. */
export async function countUnlinkedExercises(): Promise<number> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return 0;

  const adminClient = createAdminClient();

  const { count, error } = (await typedFrom(adminClient, "workout_exercises")
    .select("id", { count: "exact", head: true })
    .is("equipment_id", null)) as { count: number | null; error: unknown };

  if (error) {
    console.error("countUnlinkedExercises error:", error);
    return 0;
  }

  return count ?? 0;
}

// ---------------------------------------------------------------------------
// bulkLinkEquipment
// ---------------------------------------------------------------------------

/** Above this, a single update is doing something nobody meant to do. */
const BULK_LINK_LIMIT = 200;

/**
 * One machine hosts many exercises, and linking them one dialog at a time is
 * how every exercise stayed unlinked. A null equipmentId unlinks instead.
 */
export async function bulkLinkEquipment(
  exerciseIds: string[],
  equipmentId: string | null,
): Promise<ActionResult & { updated?: number }> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const ids = [...new Set(exerciseIds)].filter(isValidUUID);
  if (ids.length === 0) return { error: "לא נבחרו תרגילים" };
  if (ids.length > BULK_LINK_LIMIT) {
    return { error: `אפשר לקשר עד ${BULK_LINK_LIMIT} תרגילים בבת אחת` };
  }
  if (equipmentId !== null && !isValidUUID(equipmentId)) {
    return { error: "מזהה ציוד לא תקין" };
  }

  const adminClient = createAdminClient();

  try {
    const { error: updateError } = await typedFrom(adminClient, "workout_exercises")
      .update({ equipment_id: equipmentId })
      .in("id", ids);

    if (updateError) {
      console.error("bulkLinkEquipment error:", updateError);
      return { error: "שגיאה בקישור התרגילים" };
    }

    revalidatePath(REVALIDATE_PATH);
    return { success: true, updated: ids.length };
  } catch (err) {
    console.error("bulkLinkEquipment error:", err);
    return { error: "שגיאה בקישור התרגילים" };
  }
}

// ---------------------------------------------------------------------------
// deleteExercise
// ---------------------------------------------------------------------------

/** Templates and logged sessions that would lose their exercise. */
async function countExerciseReferences(
  adminClient: ReturnType<typeof createAdminClient>,
  id: string,
): Promise<{ templates: number; sessions: number } | null> {
  const { count: templates, error: templatesError } = (await typedFrom(
    adminClient,
    "session_template_exercises",
  )
    .select("id", { count: "exact", head: true })
    .eq("exercise_id", id)) as { count: number | null; error: unknown };

  const { count: sessions, error: sessionsError } = (await typedFrom(
    adminClient,
    "training_session_exercises",
  )
    .select("id", { count: "exact", head: true })
    .eq("exercise_id", id)) as { count: number | null; error: unknown };

  if (templatesError || sessionsError) {
    console.error("countExerciseReferences error:", templatesError ?? sessionsError);
    return null;
  }

  return { templates: templates ?? 0, sessions: sessions ?? 0 };
}

export async function deleteExercise(id: string): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה תרגיל לא תקין" };

  const adminClient = createAdminClient();

  try {
    // Deleting a referenced exercise empties rows in templates and in sessions
    // trainees already logged, so refuse and say where it is used.
    const references = await countExerciseReferences(adminClient, id);
    if (!references) return { error: "שגיאה בבדיקת השימוש בתרגיל" };

    if (references.templates > 0 || references.sessions > 0) {
      const used = [
        references.templates > 0 ? `${references.templates} תבניות` : null,
        references.sessions > 0 ? `${references.sessions} אימונים` : null,
      ]
        .filter(Boolean)
        .join(" וב-");
      return { error: `לא ניתן למחוק: התרגיל בשימוש ב-${used}. אפשר לערוך אותו במקום.` };
    }

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
