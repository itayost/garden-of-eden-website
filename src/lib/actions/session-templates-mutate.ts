"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import {
  createTemplateSchema,
  templateIdSchema,
  updateTemplateSchema,
  type CreateTemplateInput,
  type UpdateTemplateInput,
} from "@/lib/validations/session-template";

type SaveResult =
  | { success: true; data: { id: string } }
  | { error: string; fieldErrors?: Record<string, string[]> };

type ActionResult = { success: true } | { error: string };

/**
 * The validated exercise rows, derived from the schema rather than restated —
 * a field added to `sessionExerciseSchema` must not silently stop being sent.
 */
type ValidatedExercises = z.output<typeof createTemplateSchema>["exercises"];

/** Minimal typed shape for RPCs missing from the generated Supabase types. */
type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>;
};

function revalidateTemplates() {
  revalidatePath("/admin/workouts/templates");
  revalidatePath("/admin/schedule");
}

function toRpcExercises(exercises: ValidatedExercises) {
  return exercises.map((exercise, index) => ({
    exercise_id: exercise.exerciseId,
    order_index: index,
    target_sets: exercise.targetSets,
    target_reps_he: exercise.targetReps,
    target_load_he: exercise.targetLoad,
    target_reps: exercise.targetRepsNum,
    target_weight_kg: exercise.targetWeightKg,
    target_duration_seconds: exercise.targetDurationSeconds,
    target_distance_m: exercise.targetDistanceM,
    notes_he: exercise.notes,
  }));
}

/**
 * Saves the trainer's current session composition as a named template.
 *
 * The exercise list goes in through the replace_template_exercises RPC — one
 * transaction — and a template whose rows failed to land is deleted rather
 * than left in the list as an empty shell.
 */
export async function createTemplateAction(
  input: CreateTemplateInput,
): Promise<SaveResult> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = createTemplateSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { name, description, exercises } = validated.data;
  const supabase = await createClient();

  const { data: created, error: insertError } = await typedFrom(
    supabase,
    "session_templates",
  )
    .insert({
      name,
      description,
      created_by: user!.id,
      created_by_name: profile!.full_name ?? "מאמן",
    })
    .select("id")
    .single();

  if (insertError || !created) {
    console.error("Create session template error:", insertError);
    return { error: "שגיאה ביצירת התבנית" };
  }

  const templateId = (created as { id: string }).id;

  const { error: rpcError } = await (supabase as unknown as RpcClient).rpc(
    "replace_template_exercises",
    {
      p_template_id: templateId,
      p_exercises: toRpcExercises(exercises),
    },
  );

  if (rpcError) {
    console.error("replace_template_exercises failed:", rpcError);
    const { error: cleanupError } = await typedFrom(supabase, "session_templates")
      .delete()
      .eq("id", templateId);
    if (cleanupError) {
      console.error(
        "Failed to clean up exercise-less template:",
        templateId,
        cleanupError,
      );
    }
    return { error: "שגיאה בשמירת תרגילי התבנית" };
  }

  revalidateTemplates();

  return { success: true, data: { id: templateId } };
}

/**
 * Renames a template and replaces its exercise list.
 *
 * The metadata update runs AFTER the exercises, so a template only ever shows
 * a new name once the list it describes actually landed.
 */
export async function updateTemplateAction(
  input: UpdateTemplateInput,
): Promise<SaveResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = updateTemplateSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { id, name, description, exercises } = validated.data;
  const supabase = await createClient();

  // `.update().eq()` on a missing row reports no error and changes nothing, so
  // existence is checked up front rather than inferred from the update.
  const { data: existing, error: findError } = await typedFrom(
    supabase,
    "session_templates",
  )
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (findError) {
    console.error("Find session template error:", findError);
    return { error: "שגיאה בטעינת התבנית" };
  }
  if (!existing) return { error: "התבנית לא נמצאה" };

  const { error: rpcError } = await (supabase as unknown as RpcClient).rpc(
    "replace_template_exercises",
    {
      p_template_id: id,
      p_exercises: toRpcExercises(exercises),
    },
  );

  if (rpcError) {
    console.error("replace_template_exercises failed:", rpcError);
    return { error: "שגיאה בשמירת תרגילי התבנית" };
  }

  const { error: metaError } = await typedFrom(supabase, "session_templates")
    .update({ name, description })
    .eq("id", id);

  if (metaError) {
    console.error("Update session template meta error:", metaError);
    return { error: "שגיאה בעדכון פרטי התבנית" };
  }

  revalidateTemplates();

  return { success: true, data: { id } };
}

/** Deletes a template. Authoring data, and nothing references it. */
export async function deleteTemplateAction(
  templateId: string,
): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = templateIdSchema.safeParse({ templateId });
  if (!validated.success) return { error: "מזהה תבנית לא תקין" };

  const supabase = await createClient();

  const { error } = await typedFrom(supabase, "session_templates")
    .delete()
    .eq("id", validated.data.templateId);

  if (error) {
    console.error("Delete session template error:", error);
    return { error: "שגיאה במחיקת התבנית" };
  }

  revalidateTemplates();

  return { success: true };
}

/**
 * Copies a template under a new name, crediting the trainer who pressed the
 * button — the copy is theirs to edit, not the original author's.
 */
export async function duplicateTemplateAction(
  templateId: string,
): Promise<SaveResult> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = templateIdSchema.safeParse({ templateId });
  if (!validated.success) return { error: "מזהה תבנית לא תקין" };

  const supabase = await createClient();

  const { data: source, error: sourceError } = await typedFrom(
    supabase,
    "session_templates",
  )
    .select(
      "id, name, description, exercises:session_template_exercises(exercise_id, order_index, target_sets, target_reps_he, target_load_he, target_reps, target_weight_kg, target_duration_seconds, target_distance_m, notes_he)",
    )
    .eq("id", validated.data.templateId)
    .maybeSingle();

  if (sourceError) {
    console.error("Duplicate template load error:", sourceError);
    return { error: "שגיאה בטעינת התבנית" };
  }
  if (!source) return { error: "התבנית לא נמצאה" };

  const template = source as {
    name: string;
    description: string | null;
    exercises: Record<string, unknown>[];
  };

  const { data: created, error: insertError } = await typedFrom(
    supabase,
    "session_templates",
  )
    .insert({
      // The name column caps at 100 chars; a long name plus the suffix would
      // otherwise fail the CHECK instead of duplicating.
      name: `${template.name} (עותק)`.slice(0, 100),
      description: template.description,
      created_by: user!.id,
      created_by_name: profile!.full_name ?? "מאמן",
    })
    .select("id")
    .single();

  if (insertError || !created) {
    console.error("Duplicate template insert error:", insertError);
    return { error: "שגיאה בשכפול התבנית" };
  }

  const newId = (created as { id: string }).id;

  const ordered = [...(template.exercises ?? [])].sort(
    (a, b) => (a.order_index as number) - (b.order_index as number),
  );

  const { error: rpcError } = await (supabase as unknown as RpcClient).rpc(
    "replace_template_exercises",
    {
      p_template_id: newId,
      p_exercises: ordered.map((exercise, index) => ({
        ...exercise,
        order_index: index,
      })),
    },
  );

  if (rpcError) {
    console.error("Duplicate template rows failed:", rpcError);
    const { error: cleanupError } = await typedFrom(supabase, "session_templates")
      .delete()
      .eq("id", newId);
    if (cleanupError) {
      console.error("Failed to clean up duplicated template:", newId, cleanupError);
    }
    return { error: "שגיאה בשכפול תרגילי התבנית" };
  }

  revalidateTemplates();

  return { success: true, data: { id: newId } };
}
