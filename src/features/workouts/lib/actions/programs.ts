"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { programMetaSchema, programRowsSchema } from "@/lib/validations/workout-program";
import type { ProgramMetaInput, ProgramRowsInput } from "@/lib/validations/workout-program";
import { resizeRowCells } from "@/features/workouts/lib/grid-utils";
import type {
  WorkoutProgram,
  ProgramCell,
  ProgramExerciseRow,
  ProgramGrid,
} from "@/features/workouts/lib/types";

export type { ProgramMetaInput, ProgramRowsInput } from "@/lib/validations/workout-program";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REVALIDATE_LIST = "/admin/workouts/programs";

// ---------------------------------------------------------------------------
// Action result type
// ---------------------------------------------------------------------------

type ActionResult =
  | { success: true }
  | { error: string; fieldErrors?: Record<string, string[]> };

// ---------------------------------------------------------------------------
// Raw DB shapes (snake_case)
// ---------------------------------------------------------------------------

interface RawWorkoutProgram {
  id: string;
  name: string;
  description: string | null;
  weeks: number;
  periodization_type: string | null;
  created_by: string | null;
  order_index: number;
}

interface RawProgramExercise {
  id: string;
  program_id: string;
  exercise_id: string;
  order_index: number;
  notes_he: string | null;
}

interface RawProgramExerciseWithName extends RawProgramExercise {
  workout_exercises: {
    name_he: string | null;
    name_en: string | null;
  } | null;
}

interface RawProgramCell {
  id: string;
  program_exercise_id: string;
  week_number: number;
  sets: number | null;
  reps_he: string | null;
  load_he: string | null;
  notes_he: string | null;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapProgram(raw: RawWorkoutProgram): WorkoutProgram {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    weeks: raw.weeks,
    periodizationType: raw.periodization_type,
    createdBy: raw.created_by,
    orderIndex: raw.order_index,
  };
}

function mapCell(raw: RawProgramCell): ProgramCell {
  return {
    week: raw.week_number,
    sets: raw.sets,
    repsHe: raw.reps_he ?? "",
    loadHe: raw.load_he ?? "",
    notesHe: raw.notes_he ?? "",
  };
}

// ---------------------------------------------------------------------------
// listPrograms
// ---------------------------------------------------------------------------

export async function listPrograms(): Promise<WorkoutProgram[]> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return [];

  const adminClient = createAdminClient();

  const { data, error } = (await typedFrom(adminClient, "workout_programs")
    .select("id, name, description, weeks, periodization_type, created_by, order_index")
    .order("order_index")) as { data: RawWorkoutProgram[] | null; error: unknown };

  if (error) {
    console.error("listPrograms query error:", error);
    return [];
  }

  return (data ?? []).map(mapProgram);
}

// ---------------------------------------------------------------------------
// createProgram
// ---------------------------------------------------------------------------

export async function createProgram(
  input: ProgramMetaInput
): Promise<{ success: true; programId: string } | { error: string; fieldErrors?: Record<string, string[]> }> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = programMetaSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const serverClient = await createClient();
  const { data: { user } } = await serverClient.auth.getUser();

  const adminClient = createAdminClient();

  try {
    const { data: maxOrder } = (await typedFrom(adminClient, "workout_programs")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: { order_index: number } | null };

    const orderIndex = (maxOrder?.order_index ?? 0) + 1;

    const { data: created, error: insertError } = (await typedFrom(
      adminClient,
      "workout_programs"
    )
      .insert({
        name: validated.data.name,
        description: validated.data.description ?? null,
        weeks: validated.data.weeks,
        periodization_type: validated.data.periodization_type ?? null,
        created_by: user?.id ?? null,
        order_index: orderIndex,
      })
      .select("id")
      .single()) as { data: { id: string } | null; error: unknown };

    if (insertError || !created) {
      console.error("createProgram insert error:", insertError);
      return { error: "שגיאה ביצירת תוכנית" };
    }

    revalidatePath(REVALIDATE_LIST);
    return { success: true, programId: created.id };
  } catch (err) {
    console.error("createProgram error:", err);
    return { error: "שגיאה ביצירת תוכנית" };
  }
}

// ---------------------------------------------------------------------------
// duplicateProgram
// ---------------------------------------------------------------------------

export async function duplicateProgram(id: string): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה תוכנית לא תקין" };

  const adminClient = createAdminClient();

  try {
    // Load source program
    const { data: sourceProgram, error: programError } = (await typedFrom(
      adminClient,
      "workout_programs"
    )
      .select("id, name, description, weeks, periodization_type, created_by, order_index")
      .eq("id", id)
      .maybeSingle()) as { data: RawWorkoutProgram | null; error: unknown };

    if (programError || !sourceProgram) {
      console.error("duplicateProgram load error:", programError);
      return { error: "תוכנית לא נמצאה" };
    }

    // Load source exercises
    const { data: sourceExercises, error: exercisesError } = (await typedFrom(
      adminClient,
      "workout_program_exercises"
    )
      .select("id, program_id, exercise_id, order_index, notes_he")
      .eq("program_id", id)
      .order("order_index")) as { data: RawProgramExercise[] | null; error: unknown };

    if (exercisesError) {
      console.error("duplicateProgram exercises error:", exercisesError);
      return { error: "שגיאה בטעינת תרגילי התוכנית" };
    }

    const exercises = sourceExercises ?? [];
    const exerciseIds = exercises.map((e) => e.id);

    // Load all cells for those exercises
    let sourceCells: RawProgramCell[] = [];
    if (exerciseIds.length > 0) {
      const { data: cellsData, error: cellsError } = (await typedFrom(
        adminClient,
        "workout_program_cells"
      )
        .select("id, program_exercise_id, week_number, sets, reps_he, load_he, notes_he")
        .in("program_exercise_id", exerciseIds)) as {
        data: RawProgramCell[] | null;
        error: unknown;
      };

      if (cellsError) {
        console.error("duplicateProgram cells error:", cellsError);
        return { error: "שגיאה בטעינת תאי התוכנית" };
      }

      sourceCells = cellsData ?? [];
    }

    // Get max order index for the new program
    const { data: maxOrder } = (await typedFrom(adminClient, "workout_programs")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: { order_index: number } | null };

    const newOrderIndex = (maxOrder?.order_index ?? 0) + 1;

    // Insert the duplicate program
    const { data: newProgram, error: newProgramError } = (await typedFrom(
      adminClient,
      "workout_programs"
    )
      .insert({
        name: `${sourceProgram.name} (עותק)`,
        description: sourceProgram.description,
        weeks: sourceProgram.weeks,
        periodization_type: sourceProgram.periodization_type,
        created_by: sourceProgram.created_by,
        order_index: newOrderIndex,
      })
      .select("id")
      .single()) as { data: { id: string } | null; error: unknown };

    if (newProgramError || !newProgram) {
      console.error("duplicateProgram insert error:", newProgramError);
      return { error: "שגיאה ביצירת עותק תוכנית" };
    }

    // Re-insert exercises and their cells; clean up copy program on any failure
    for (const exercise of exercises) {
      const { data: newExercise, error: newExerciseError } = (await typedFrom(
        adminClient,
        "workout_program_exercises"
      )
        .insert({
          program_id: newProgram.id,
          exercise_id: exercise.exercise_id,
          order_index: exercise.order_index,
          notes_he: exercise.notes_he,
        })
        .select("id")
        .single()) as { data: { id: string } | null; error: unknown };

      if (newExerciseError || !newExercise) {
        console.error("duplicateProgram exercise insert error:", newExerciseError);
        await typedFrom(adminClient, "workout_programs").delete().eq("id", newProgram.id);
        return { error: "שגיאה בשכפול תרגיל" };
      }

      const cellsForRow = sourceCells.filter(
        (c) => c.program_exercise_id === exercise.id
      );

      if (cellsForRow.length > 0) {
        const cellsToInsert = cellsForRow.map((c) => ({
          program_exercise_id: newExercise.id,
          week_number: c.week_number,
          sets: c.sets,
          reps_he: c.reps_he,
          load_he: c.load_he,
          notes_he: c.notes_he,
        }));

        const { error: cellsInsertError } = await typedFrom(
          adminClient,
          "workout_program_cells"
        ).insert(cellsToInsert);

        if (cellsInsertError) {
          console.error("duplicateProgram cells insert error:", cellsInsertError);
          await typedFrom(adminClient, "workout_programs").delete().eq("id", newProgram.id);
          return { error: "שגיאה בשכפול תאי תרגיל" };
        }
      }
    }

    revalidatePath(REVALIDATE_LIST);
    return { success: true };
  } catch (err) {
    console.error("duplicateProgram error:", err);
    return { error: "שגיאה בשכפול תוכנית" };
  }
}

// ---------------------------------------------------------------------------
// deleteProgram
// ---------------------------------------------------------------------------

export async function deleteProgram(id: string): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה תוכנית לא תקין" };

  const adminClient = createAdminClient();

  try {
    const { error: deleteError } = await typedFrom(adminClient, "workout_programs")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("deleteProgram error:", deleteError);
      return { error: "שגיאה במחיקת תוכנית" };
    }

    revalidatePath(REVALIDATE_LIST);
    return { success: true };
  } catch (err) {
    console.error("deleteProgram error:", err);
    return { error: "שגיאה במחיקת תוכנית" };
  }
}

// ---------------------------------------------------------------------------
// getProgramForEdit
// ---------------------------------------------------------------------------

export async function getProgramForEdit(id: string): Promise<ProgramGrid | null> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return null;

  if (!isValidUUID(id)) return null;

  const adminClient = createAdminClient();

  try {
    // Load program meta
    const { data: rawProgram, error: programError } = (await typedFrom(
      adminClient,
      "workout_programs"
    )
      .select("id, name, description, weeks, periodization_type, created_by, order_index")
      .eq("id", id)
      .maybeSingle()) as { data: RawWorkoutProgram | null; error: unknown };

    if (programError || !rawProgram) {
      if (programError) console.error("getProgramForEdit program error:", programError);
      return null;
    }

    const program = mapProgram(rawProgram);

    // Load exercises joined to workout_exercises for the display name
    const { data: rawExercises, error: exercisesError } = (await typedFrom(
      adminClient,
      "workout_program_exercises"
    )
      .select(
        "id, program_id, exercise_id, order_index, notes_he, workout_exercises(name_he, name_en)"
      )
      .eq("program_id", id)
      .order("order_index")) as {
      data: RawProgramExerciseWithName[] | null;
      error: unknown;
    };

    if (exercisesError) {
      console.error("getProgramForEdit exercises error:", exercisesError);
      return null;
    }

    const exercises = rawExercises ?? [];
    const exerciseIds = exercises.map((e) => e.id);

    // Load cells
    let allCells: RawProgramCell[] = [];
    if (exerciseIds.length > 0) {
      const { data: cellsData, error: cellsError } = (await typedFrom(
        adminClient,
        "workout_program_cells"
      )
        .select("id, program_exercise_id, week_number, sets, reps_he, load_he, notes_he")
        .in("program_exercise_id", exerciseIds)) as {
        data: RawProgramCell[] | null;
        error: unknown;
      };

      if (cellsError) {
        console.error("getProgramForEdit cells error:", cellsError);
        return null;
      }

      allCells = cellsData ?? [];
    }

    // Group cells by program_exercise_id
    const cellsByExercise = allCells.reduce<Record<string, ProgramCell[]>>((acc, raw) => {
      const existing = acc[raw.program_exercise_id] ?? [];
      return {
        ...acc,
        [raw.program_exercise_id]: [...existing, mapCell(raw)],
      };
    }, {});

    // Assemble rows — each row's cells normalized to program.weeks
    const rows: ProgramExerciseRow[] = exercises.map((ex) => {
      const joinedExercise = ex.workout_exercises;
      const exerciseName =
        joinedExercise?.name_he ?? joinedExercise?.name_en ?? "";

      const rawCells = cellsByExercise[ex.id] ?? [];
      const normalizedCells = resizeRowCells(rawCells, program.weeks);

      return {
        key: ex.id,
        exerciseId: ex.exercise_id,
        exerciseName,
        notesHe: ex.notes_he ?? "",
        cells: normalizedCells,
      };
    });

    return { program, rows };
  } catch (err) {
    console.error("getProgramForEdit error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// saveProgram
// ---------------------------------------------------------------------------

export async function saveProgram(
  id: string,
  meta: ProgramMetaInput,
  rows: ProgramRowsInput
): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה תוכנית לא תקין" };

  const validatedMeta = programMetaSchema.safeParse(meta);
  if (!validatedMeta.success) {
    return {
      error: "אימות נתוני תוכנית נכשל",
      fieldErrors: validatedMeta.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const validatedRows = programRowsSchema.safeParse(rows);
  if (!validatedRows.success) {
    return {
      error: "אימות נתוני תרגילים נכשל",
      fieldErrors: validatedRows.error.flatten().fieldErrors as unknown as Record<string, string[]>,
    };
  }

  const adminClient = createAdminClient();

  try {
    // (a) Update program meta
    const { error: updateError } = await typedFrom(adminClient, "workout_programs")
      .update({
        name: validatedMeta.data.name,
        description: validatedMeta.data.description ?? null,
        weeks: validatedMeta.data.weeks,
        periodization_type: validatedMeta.data.periodization_type ?? null,
      })
      .eq("id", id);

    if (updateError) {
      console.error("saveProgram update meta error:", updateError);
      return { error: "שגיאה בעדכון פרטי תוכנית" };
    }

    // (b) REPLACE the grid atomically via a plpgsql RPC (single implicit transaction)
    const rowsJson = validatedRows.data.map((row, i) => ({
      exercise_id: row.exercise_id,
      order_index: i,
      notes_he: row.notes_he ?? null,
      cells: (row.cells ?? []).map((cl) => ({
        week: cl.week,
        sets: cl.sets,
        reps_he: cl.reps_he,
        load_he: cl.load_he,
        notes_he: cl.notes_he,
      })),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: gridError } = await (adminClient as any).rpc("save_workout_program_grid", {
      p_program_id: id,
      p_rows: rowsJson,
    });

    if (gridError) {
      console.error("save_workout_program_grid failed:", gridError);
      return { error: "שמירת התוכנית נכשלה" };
    }

    revalidatePath(REVALIDATE_LIST);
    revalidatePath(`${REVALIDATE_LIST}/${id}`);
    return { success: true };
  } catch (err) {
    console.error("saveProgram error:", err);
    return { error: "שגיאה בשמירת התוכנית" };
  }
}
