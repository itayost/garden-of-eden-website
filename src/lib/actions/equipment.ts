"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { verifyAdmin, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { DEFAULT_WEIGHT_STEP_KG } from "@/lib/utils/performance-profile";
import {
  equipmentCreateSchema,
  equipmentUpdateSchema,
  type EquipmentCreateInput,
  type EquipmentUpdateInput,
} from "@/lib/validations/exercise-log";
import type { Equipment, EquipmentWithUsage } from "@/types/equipment";

type ListResult = { success: true; data: Equipment[] } | { error: string };
type UsageResult =
  | { success: true; data: EquipmentWithUsage[] }
  | { error: string };
type MutateResult =
  | { success: true; data: Equipment }
  | { error: string; fieldErrors?: Record<string, string[]> };

/** The performance-profile columns, mapped camelCase form -> snake_case DB. */
function profileColumns(
  data: Pick<
    z.output<typeof equipmentCreateSchema>,
    | "tracksWeight"
    | "tracksReps"
    | "tracksDuration"
    | "tracksDistance"
    | "defaultSets"
    | "defaultReps"
    | "defaultWeightKg"
    | "defaultDurationSeconds"
    | "defaultDistanceM"
    | "weightMinKg"
    | "weightMaxKg"
    | "weightStepKg"
    | "howto"
  >,
) {
  return {
    tracks_weight: data.tracksWeight,
    tracks_reps: data.tracksReps,
    tracks_duration: data.tracksDuration,
    tracks_distance: data.tracksDistance,
    default_sets: data.defaultSets,
    default_reps: data.defaultReps,
    default_weight_kg: data.defaultWeightKg,
    default_duration_seconds: data.defaultDurationSeconds,
    default_distance_m: data.defaultDistanceM,
    weight_min_kg: data.weightMinKg,
    weight_max_kg: data.weightMaxKg,
    // NOT NULL in the DB; an omitted step means "use the standard".
    weight_step_kg: data.weightStepKg ?? DEFAULT_WEIGHT_STEP_KG,
    howto_he: data.howto,
  };
}

/**
 * Short, URL-safe, unambiguous code for the QR sticker. 8 chars from a
 * 30-char alphabet (no 0/O/1/I/L) is ~6.5e11 combinations — collisions are
 * handled by retrying on the UNIQUE constraint.
 */
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 8;

function generateEquipmentCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** The full catalog, active first. Staff-only (the table and pickers). */
export async function listEquipmentAction(): Promise<ListResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "equipment")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name_he", { ascending: true });

  if (error) {
    console.error("List equipment error:", error);
    return { error: "שגיאה בטעינת הציוד" };
  }

  return { success: true, data: (data ?? []) as Equipment[] };
}

/**
 * The catalog plus how many library exercises point at each machine.
 *
 * A zero count is the signal worth surfacing: that machine's sticker scans
 * fine but can never match an exercise in a session, which is silent today.
 */
export async function listEquipmentWithUsageAction(): Promise<UsageResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const supabase = await createClient();

  // PostgREST aggregates the count in the same round trip, so this returns one
  // row per machine rather than one row per linked exercise.
  const { data, error } = await typedFrom(supabase, "equipment")
    .select("*, workout_exercises(count)")
    .order("is_active", { ascending: false })
    .order("name_he", { ascending: true });

  if (error) {
    console.error("List equipment usage error:", error);
    return { error: "שגיאה בטעינת הציוד" };
  }

  const rows = (data ?? []) as (Equipment & {
    workout_exercises?: { count: number }[];
  })[];

  return {
    success: true,
    data: rows.map(({ workout_exercises, ...item }) => ({
      ...item,
      exerciseCount: workout_exercises?.[0]?.count ?? 0,
    })),
  };
}

export async function createEquipmentAction(
  input: EquipmentCreateInput,
): Promise<MutateResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = equipmentCreateSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();

  // Retry on the astronomically-unlikely code collision rather than
  // pre-checking (which would race anyway).
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: created, error } = await typedFrom(supabase, "equipment")
      .insert({
        name_he: validated.data.name,
        notes_he: validated.data.notes,
        code: generateEquipmentCode(),
        ...profileColumns(validated.data),
      })
      .select()
      .single();

    if (!error && created) {
      revalidatePath("/admin/workouts/equipment");
      return { success: true, data: created as Equipment };
    }

    if ((error as { code?: string } | null)?.code !== "23505") {
      console.error("Create equipment error:", error);
      return { error: "שגיאה ביצירת הציוד" };
    }
  }

  return { error: "שגיאה ביצירת הציוד" };
}

/** Name/notes/active are editable; the code never is — stickers are printed. */
export async function updateEquipmentAction(
  input: EquipmentUpdateInput,
): Promise<MutateResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = equipmentUpdateSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const { data: updated, error } = await typedFrom(supabase, "equipment")
    .update({
      name_he: validated.data.name,
      notes_he: validated.data.notes,
      is_active: validated.data.isActive,
      ...profileColumns(validated.data),
    })
    .eq("id", validated.data.equipmentId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("Update equipment error:", error);
    return { error: "שגיאה בעדכון הציוד" };
  }
  if (!updated) return { error: "הציוד לא נמצא" };

  revalidatePath("/admin/workouts/equipment");

  return { success: true, data: updated as Equipment };
}
