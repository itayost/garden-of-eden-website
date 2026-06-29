"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import {
  parameterBaseSchema,
  drillsInputSchema,
  ageRowsInputSchema,
} from "@/lib/validations/book-parameter";
import type {
  ParameterBaseInput,
  DrillRowInput,
  AgeRowInput,
} from "@/lib/validations/book-parameter";
import type {
  BookDrill,
  BookAgeRow,
  BookParameter,
  CanonicalPosition,
} from "../types";

// Note: ParameterBaseInput, DrillRowInput, AgeRowInput are exported from
// @/lib/validations/book-parameter — import from there when needed in client code.

// ---------------------------------------------------------------------------
// Action result type
// ---------------------------------------------------------------------------

type ActionResult =
  | { success: true }
  | { error: string; fieldErrors?: Record<string, string[]> };

// ---------------------------------------------------------------------------
// Raw DB shapes (snake_case)
// ---------------------------------------------------------------------------

interface RawParameter {
  id: string;
  category_id: string;
  number: number | null;
  slug: string;
  name_he: string;
  subtitle_he: string | null;
  order_index: number;
  is_all_positions: boolean;
  age_metric_label: string | null;
  report_text_he: string | null;
  report_highlight_he: string | null;
  verbal_text_he: string | null;
  verbal_tip_he: string | null;
}

interface RawParameterPosition {
  parameter_id: string;
  position: string;
}

interface RawDrill {
  id: string;
  parameter_id: string;
  slug: string;
  name_en: string | null;
  name_he: string | null;
  muscle_he: string | null;
  sets_he: string | null;
  how_he: string | null;
  why_he: string | null;
  connect_he: string | null;
  order_index: number;
}

interface RawAgeRow {
  id: string;
  parameter_id: string;
  age_group: string;
  what_he: string | null;
  metric_value_he: string | null;
  recovery_he: string | null;
  order_index: number;
}

// ---------------------------------------------------------------------------
// Public shape returned to callers
// ---------------------------------------------------------------------------

export interface AdminParameterForEdit extends BookParameter {
  drills: BookDrill[];
  ageRows: BookAgeRow[];
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapDrill(row: RawDrill): BookDrill {
  return {
    id: row.id,
    parameterId: row.parameter_id,
    slug: row.slug,
    nameEn: row.name_en,
    nameHe: row.name_he,
    muscleHe: row.muscle_he,
    setsHe: row.sets_he,
    howHe: row.how_he,
    whyHe: row.why_he,
    connectHe: row.connect_he,
    orderIndex: row.order_index,
  };
}

function mapAgeRow(row: RawAgeRow): BookAgeRow {
  return {
    id: row.id,
    ageGroup: row.age_group as BookAgeRow["ageGroup"],
    whatHe: row.what_he,
    metricValueHe: row.metric_value_he,
    recoveryHe: row.recovery_he,
    orderIndex: row.order_index,
  };
}

// ---------------------------------------------------------------------------
// getParameterForEdit
// ---------------------------------------------------------------------------

export async function getParameterForEdit(
  id: string
): Promise<AdminParameterForEdit | null> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return null;

  if (!isValidUUID(id)) return null;

  const adminClient = createAdminClient();

  const [paramResult, posResult, drillResult, ageResult] = await Promise.all([
    typedFrom(adminClient, "book_parameters")
      .select(
        "id, category_id, number, slug, name_he, subtitle_he, order_index, is_all_positions, age_metric_label, report_text_he, report_highlight_he, verbal_text_he, verbal_tip_he"
      )
      .eq("id", id)
      .maybeSingle() as Promise<{ data: RawParameter | null; error: unknown }>,

    typedFrom(adminClient, "book_parameter_positions")
      .select("parameter_id, position")
      .eq("parameter_id", id) as Promise<{
      data: RawParameterPosition[] | null;
      error: unknown;
    }>,

    typedFrom(adminClient, "book_drills")
      .select(
        "id, parameter_id, slug, name_en, name_he, muscle_he, sets_he, how_he, why_he, connect_he, order_index"
      )
      .eq("parameter_id", id)
      .order("order_index") as Promise<{
      data: RawDrill[] | null;
      error: unknown;
    }>,

    typedFrom(adminClient, "book_age_rows")
      .select(
        "id, parameter_id, age_group, what_he, metric_value_he, recovery_he, order_index"
      )
      .eq("parameter_id", id)
      .order("order_index") as Promise<{
      data: RawAgeRow[] | null;
      error: unknown;
    }>,
  ]);

  const raw = (paramResult as { data: RawParameter | null }).data;
  if (!raw) return null;

  const positions = ((posResult as { data: RawParameterPosition[] | null }).data ?? []).map(
    (p) => p.position as CanonicalPosition
  );

  const drills = ((drillResult as { data: RawDrill[] | null }).data ?? []).map(mapDrill);
  const ageRows = ((ageResult as { data: RawAgeRow[] | null }).data ?? []).map(mapAgeRow);

  return {
    id: raw.id,
    categoryId: raw.category_id,
    number: raw.number,
    slug: raw.slug,
    nameHe: raw.name_he,
    subtitleHe: raw.subtitle_he,
    orderIndex: raw.order_index,
    isAllPositions: raw.is_all_positions,
    ageMetricLabel: raw.age_metric_label,
    reportTextHe: raw.report_text_he,
    reportHighlightHe: raw.report_highlight_he,
    verbalTextHe: raw.verbal_text_he,
    verbalTipHe: raw.verbal_tip_he,
    positions,
    drills,
    ageRows,
  };
}

// ---------------------------------------------------------------------------
// updateParameter — save base fields + replace book_parameter_positions
// ---------------------------------------------------------------------------

export async function updateParameter(
  id: string,
  input: ParameterBaseInput
): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה פרמטר לא תקין" };

  const validated = parameterBaseSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const adminClient = createAdminClient();

  try {
    // Update base fields
    const { error: updateError } = await typedFrom(
      adminClient,
      "book_parameters"
    ).update({
      name_he: validated.data.name_he,
      number: validated.data.number ?? null,
      subtitle_he: validated.data.subtitle_he ?? null,
      age_metric_label: validated.data.age_metric_label ?? null,
      report_text_he: validated.data.report_text_he ?? null,
      report_highlight_he: validated.data.report_highlight_he ?? null,
      verbal_text_he: validated.data.verbal_text_he ?? null,
      verbal_tip_he: validated.data.verbal_tip_he ?? null,
      is_all_positions: validated.data.is_all_positions,
    }).eq("id", id);

    if (updateError) {
      console.error("updateParameter update error:", updateError);
      return { error: "שגיאה בעדכון פרמטר" };
    }

    // Replace positions (no external FK references on book_parameter_positions)
    const { error: deleteError } = await typedFrom(
      adminClient,
      "book_parameter_positions"
    )
      .delete()
      .eq("parameter_id", id);

    if (deleteError) {
      console.error("updateParameter delete positions error:", deleteError);
      return { error: "שגיאה בעדכון עמדות" };
    }

    if (!validated.data.is_all_positions && validated.data.positions.length > 0) {
      const positionRows = validated.data.positions.map((pos) => ({
        parameter_id: id,
        position: pos,
      }));

      const { error: insertError } = await typedFrom(
        adminClient,
        "book_parameter_positions"
      ).insert(positionRows);

      if (insertError) {
        console.error("updateParameter insert positions error:", insertError);
        return { error: "שגיאה בהוספת עמדות" };
      }
    }

    revalidatePath("/admin/book");
    revalidatePath(`/admin/book/parameters/${id}`);
    revalidatePath("/dashboard/book");
    return { success: true };
  } catch (err) {
    console.error("updateParameter error:", err);
    return { error: "שגיאה בעדכון פרמטר" };
  }
}

// ---------------------------------------------------------------------------
// saveParameterDrills — upsert-by-id / insert-new / delete-removed
// ---------------------------------------------------------------------------

export async function saveParameterDrills(
  parameterId: string,
  rows: DrillRowInput[]
): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(parameterId)) return { error: "מזהה פרמטר לא תקין" };

  const validated = drillsInputSchema.safeParse(rows);
  if (!validated.success) {
    return { error: "אימות נתונים נכשל" };
  }

  const adminClient = createAdminClient();

  try {
    // Fetch existing drill ids for this parameter
    const { data: existingRaw } = (await typedFrom(adminClient, "book_drills")
      .select("id")
      .eq("parameter_id", parameterId)) as {
      data: { id: string }[] | null;
    };

    const existingIds = new Set((existingRaw ?? []).map((r) => r.id));

    const submittedIds = new Set(
      validated.data.filter((r) => r.id).map((r) => r.id as string)
    );

    // Delete drills that are no longer in the submitted set
    const toDeleteIds = [...existingIds].filter((eid) => !submittedIds.has(eid));
    if (toDeleteIds.length > 0) {
      const { error: deleteError } = await typedFrom(adminClient, "book_drills")
        .delete()
        .in("id", toDeleteIds);

      if (deleteError) {
        console.error("saveParameterDrills delete error:", deleteError);
        return { error: "שגיאה במחיקת תרגילים" };
      }
    }

    // Update existing drills and insert new ones
    for (let i = 0; i < validated.data.length; i++) {
      const row = validated.data[i];
      const orderIndex = i;

      if (row.id && existingIds.has(row.id)) {
        // UPDATE existing drill by id
        const { error: updateError } = await typedFrom(adminClient, "book_drills")
          .update({
            name_en: row.name_en ?? null,
            name_he: row.name_he ?? null,
            muscle_he: row.muscle_he ?? null,
            sets_he: row.sets_he ?? null,
            how_he: row.how_he ?? null,
            why_he: row.why_he ?? null,
            connect_he: row.connect_he ?? null,
            order_index: orderIndex,
          })
          .eq("id", row.id);

        if (updateError) {
          console.error("saveParameterDrills update error:", updateError);
          return { error: "שגיאה בעדכון תרגיל" };
        }
      } else {
        // INSERT new drill with unique slug
        const slug = `drill-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

        const { error: insertError } = await typedFrom(adminClient, "book_drills")
          .insert({
            parameter_id: parameterId,
            slug,
            name_en: row.name_en ?? null,
            name_he: row.name_he ?? null,
            muscle_he: row.muscle_he ?? null,
            sets_he: row.sets_he ?? null,
            how_he: row.how_he ?? null,
            why_he: row.why_he ?? null,
            connect_he: row.connect_he ?? null,
            order_index: orderIndex,
          });

        if (insertError) {
          console.error("saveParameterDrills insert error:", insertError);
          return { error: "שגיאה בהוספת תרגיל" };
        }
      }
    }

    revalidatePath("/admin/book");
    revalidatePath(`/admin/book/parameters/${parameterId}`);
    revalidatePath("/dashboard/book");
    return { success: true };
  } catch (err) {
    console.error("saveParameterDrills error:", err);
    return { error: "שגיאה בשמירת תרגילים" };
  }
}

// ---------------------------------------------------------------------------
// saveParameterAgeRows — delete-all + insert submitted set
// ---------------------------------------------------------------------------

export async function saveParameterAgeRows(
  parameterId: string,
  rows: AgeRowInput[]
): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(parameterId)) return { error: "מזהה פרמטר לא תקין" };

  const validated = ageRowsInputSchema.safeParse(rows);
  if (!validated.success) {
    return { error: "אימות נתונים נכשל" };
  }

  const adminClient = createAdminClient();

  try {
    // Delete all existing age rows for this parameter (no external FK references)
    const { error: deleteError } = await typedFrom(adminClient, "book_age_rows")
      .delete()
      .eq("parameter_id", parameterId);

    if (deleteError) {
      console.error("saveParameterAgeRows delete error:", deleteError);
      return { error: "שגיאה במחיקת שורות גיל" };
    }

    if (validated.data.length > 0) {
      const insertRows = validated.data.map((row, i) => ({
        parameter_id: parameterId,
        age_group: row.age_group,
        what_he: row.what_he ?? null,
        metric_value_he: row.metric_value_he ?? null,
        recovery_he: row.recovery_he ?? null,
        order_index: i,
      }));

      const { error: insertError } = await typedFrom(adminClient, "book_age_rows")
        .insert(insertRows);

      if (insertError) {
        console.error("saveParameterAgeRows insert error:", insertError);
        return { error: "שגיאה בהוספת שורות גיל" };
      }
    }

    revalidatePath("/admin/book");
    revalidatePath(`/admin/book/parameters/${parameterId}`);
    revalidatePath("/dashboard/book");
    return { success: true };
  } catch (err) {
    console.error("saveParameterAgeRows error:", err);
    return { error: "שגיאה בשמירת שורות גיל" };
  }
}
