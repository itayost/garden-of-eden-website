"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import {
  drillBaseSchema,
  cardBaseSchema,
  failureStepsInputSchema,
  phasesInputSchema,
  metricsInputSchema,
} from "@/lib/validations/book-drill-card";
import type {
  DrillBaseInput,
  CardBaseInput,
  FailureStepRowInput,
  PhaseRowInput,
  MetricRowInput,
} from "@/lib/validations/book-drill-card";
import type {
  BookDrill,
  BookDrillCard,
  FailureStep,
  CardPhase,
  CardPhasePoint,
  CardMetric,
} from "../types";

// ---------------------------------------------------------------------------
// Action result type
// ---------------------------------------------------------------------------

type ActionResult =
  | { success: true }
  | { error: string; fieldErrors?: Record<string, string[]> };

type UpsertCardResult =
  | { success: true; cardId: string }
  | { error: string };

// ---------------------------------------------------------------------------
// Raw DB shapes (snake_case)
// ---------------------------------------------------------------------------

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

interface RawDrillCard {
  id: string;
  drill_id: string;
  situation_label_he: string | null;
  subtitle_he: string | null;
  age_min_label: string | null;
  level_label: string | null;
  golden_rule_he: string | null;
}

interface RawFailureStep {
  id: string;
  card_id: string;
  text_he: string;
  is_final: boolean;
  order_index: number;
}

interface RawCardPhase {
  id: string;
  card_id: string;
  number: number | null;
  name_he: string;
  subtitle_he: string | null;
  drill_note_he: string | null;
  order_index: number;
}

interface RawCardPhasePoint {
  id: string;
  phase_id: string;
  text_he: string;
  order_index: number;
}

interface RawCardMetric {
  id: string;
  card_id: string;
  label_he: string;
  before_he: string | null;
  target_he: string | null;
  order_index: number;
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
    muscles: [],
    muscleIds: [],
    setsHe: row.sets_he,
    howHe: row.how_he,
    whyHe: row.why_he,
    connectHe: row.connect_he,
    orderIndex: row.order_index,
  };
}

function mapFailureStep(row: RawFailureStep): FailureStep {
  return {
    id: row.id,
    textHe: row.text_he,
    isFinal: row.is_final,
    orderIndex: row.order_index,
  };
}

function mapCardPhasePoint(row: RawCardPhasePoint): CardPhasePoint {
  return {
    id: row.id,
    textHe: row.text_he,
    orderIndex: row.order_index,
  };
}

function mapCardPhase(row: RawCardPhase, points: CardPhasePoint[]): CardPhase {
  return {
    id: row.id,
    number: row.number,
    nameHe: row.name_he,
    subtitleHe: row.subtitle_he,
    drillNoteHe: row.drill_note_he,
    orderIndex: row.order_index,
    points,
  };
}

function mapCardMetric(row: RawCardMetric): CardMetric {
  return {
    id: row.id,
    labelHe: row.label_he,
    beforeHe: row.before_he,
    targetHe: row.target_he,
    orderIndex: row.order_index,
  };
}

// ---------------------------------------------------------------------------
// getDrillForEdit
// ---------------------------------------------------------------------------

export async function getDrillForEdit(
  id: string
): Promise<{ drill: BookDrill; card: BookDrillCard | null } | null> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return null;

  if (!isValidUUID(id)) return null;

  const adminClient = createAdminClient();

  const { data: rawDrill } = (await typedFrom(adminClient, "book_drills")
    .select("id, parameter_id, slug, name_en, name_he, muscle_he, sets_he, how_he, why_he, connect_he, order_index")
    .eq("id", id)
    .maybeSingle()) as { data: RawDrill | null };

  if (!rawDrill) return null;

  const drill = mapDrill(rawDrill);

  const { data: rawCard } = (await typedFrom(adminClient, "book_drill_cards")
    .select("id, drill_id, situation_label_he, subtitle_he, age_min_label, level_label, golden_rule_he")
    .eq("drill_id", id)
    .maybeSingle()) as { data: RawDrillCard | null };

  if (!rawCard) {
    return { drill, card: null };
  }

  const [stepsResult, phasesResult, metricsResult] = await Promise.all([
    typedFrom(adminClient, "book_drill_card_failure_steps")
      .select("id, card_id, text_he, is_final, order_index")
      .eq("card_id", rawCard.id)
      .order("order_index") as Promise<{ data: RawFailureStep[] | null }>,
    typedFrom(adminClient, "book_drill_card_phases")
      .select("id, card_id, number, name_he, subtitle_he, drill_note_he, order_index")
      .eq("card_id", rawCard.id)
      .order("order_index") as Promise<{ data: RawCardPhase[] | null }>,
    typedFrom(adminClient, "book_drill_card_metrics")
      .select("id, card_id, label_he, before_he, target_he, order_index")
      .eq("card_id", rawCard.id)
      .order("order_index") as Promise<{ data: RawCardMetric[] | null }>,
  ]);

  const rawPhases: RawCardPhase[] = phasesResult.data ?? [];
  const phaseIds = rawPhases.map((p) => p.id);

  const rawPhasePoints: RawCardPhasePoint[] =
    phaseIds.length > 0
      ? (
          (await typedFrom(adminClient, "book_drill_card_phase_points")
            .select("id, phase_id, text_he, order_index")
            .in("phase_id", phaseIds)
            .order("order_index")) as { data: RawCardPhasePoint[] | null }
        ).data ?? []
      : [];

  const pointsByPhase = rawPhasePoints.reduce<Record<string, CardPhasePoint[]>>((acc, row) => {
    const existing = acc[row.phase_id] ?? [];
    return { ...acc, [row.phase_id]: [...existing, mapCardPhasePoint(row)] };
  }, {});

  const failureSteps: FailureStep[] = (stepsResult.data ?? []).map(mapFailureStep);
  const phases: CardPhase[] = rawPhases.map((row) =>
    mapCardPhase(row, pointsByPhase[row.id] ?? [])
  );
  const metrics: CardMetric[] = (metricsResult.data ?? []).map(mapCardMetric);

  const card: BookDrillCard = {
    id: rawCard.id,
    drillId: rawCard.drill_id,
    situationLabelHe: rawCard.situation_label_he,
    subtitleHe: rawCard.subtitle_he,
    ageMinLabel: rawCard.age_min_label,
    levelLabel: rawCard.level_label,
    goldenRuleHe: rawCard.golden_rule_he,
    failureSteps,
    phases,
    metrics,
  };

  return { drill, card };
}

// ---------------------------------------------------------------------------
// updateDrill — save drill base fields
// ---------------------------------------------------------------------------

export async function updateDrill(
  id: string,
  input: DrillBaseInput
): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה תרגיל לא תקין" };

  const validated = drillBaseSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const adminClient = createAdminClient();

  try {
    const { error: updateError } = await typedFrom(adminClient, "book_drills")
      .update({
        name_en: validated.data.name_en ?? null,
        name_he: validated.data.name_he ?? null,
        muscle_he: validated.data.muscle_he ?? null,
        sets_he: validated.data.sets_he ?? null,
        how_he: validated.data.how_he ?? null,
        why_he: validated.data.why_he ?? null,
        connect_he: validated.data.connect_he ?? null,
      })
      .eq("id", id);

    if (updateError) {
      console.error("updateDrill error:", updateError);
      return { error: "שגיאה בעדכון תרגיל" };
    }

    revalidatePath("/admin/book");
    revalidatePath(`/admin/book/drills/${id}`);
    revalidatePath("/dashboard/book");
    revalidatePath(`/dashboard/book/drills/${id}`);
    return { success: true };
  } catch (err) {
    console.error("updateDrill error:", err);
    return { error: "שגיאה בעדכון תרגיל" };
  }
}

// ---------------------------------------------------------------------------
// upsertDrillCard — insert or update the single card row for the drill
// ---------------------------------------------------------------------------

export async function upsertDrillCard(
  drillId: string,
  cardBase: CardBaseInput
): Promise<UpsertCardResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(drillId)) return { error: "מזהה תרגיל לא תקין" };

  const validated = cardBaseSchema.safeParse(cardBase);
  if (!validated.success) {
    return { error: "אימות נתונים נכשל" };
  }

  const adminClient = createAdminClient();

  try {
    // Check if card already exists
    const { data: existingCard } = (await typedFrom(adminClient, "book_drill_cards")
      .select("id")
      .eq("drill_id", drillId)
      .maybeSingle()) as { data: { id: string } | null };

    if (existingCard) {
      // Update existing card
      const { error: updateError } = await typedFrom(adminClient, "book_drill_cards")
        .update({
          situation_label_he: validated.data.situation_label_he ?? null,
          subtitle_he: validated.data.subtitle_he ?? null,
          age_min_label: validated.data.age_min_label ?? null,
          level_label: validated.data.level_label ?? null,
          golden_rule_he: validated.data.golden_rule_he ?? null,
        })
        .eq("id", existingCard.id);

      if (updateError) {
        console.error("upsertDrillCard update error:", updateError);
        return { error: "שגיאה בעדכון כרטיס" };
      }

      revalidatePath("/admin/book");
      revalidatePath(`/admin/book/drills/${drillId}`);
      revalidatePath("/dashboard/book");
      revalidatePath(`/dashboard/book/drills/${drillId}`);
      return { success: true, cardId: existingCard.id };
    }

    // Insert new card
    const { data: newCard, error: insertError } = (await typedFrom(
      adminClient,
      "book_drill_cards"
    )
      .insert({
        drill_id: drillId,
        situation_label_he: validated.data.situation_label_he ?? null,
        subtitle_he: validated.data.subtitle_he ?? null,
        age_min_label: validated.data.age_min_label ?? null,
        level_label: validated.data.level_label ?? null,
        golden_rule_he: validated.data.golden_rule_he ?? null,
      })
      .select("id")
      .single()) as { data: { id: string } | null; error: unknown };

    if (insertError || !newCard) {
      console.error("upsertDrillCard insert error:", insertError);
      return { error: "שגיאה ביצירת כרטיס" };
    }

    revalidatePath("/admin/book");
    revalidatePath(`/admin/book/drills/${drillId}`);
    revalidatePath("/dashboard/book");
    revalidatePath(`/dashboard/book/drills/${drillId}`);
    return { success: true, cardId: newCard.id };
  } catch (err) {
    console.error("upsertDrillCard error:", err);
    return { error: "שגיאה בשמירת כרטיס" };
  }
}

// ---------------------------------------------------------------------------
// saveFailureSteps — delete-all + insert submitted set
// ---------------------------------------------------------------------------

export async function saveFailureSteps(
  cardId: string,
  rows: FailureStepRowInput[]
): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(cardId)) return { error: "מזהה כרטיס לא תקין" };

  const validated = failureStepsInputSchema.safeParse(rows);
  if (!validated.success) {
    return { error: "אימות נתונים נכשל" };
  }

  const adminClient = createAdminClient();

  try {
    const { error: deleteError } = await typedFrom(
      adminClient,
      "book_drill_card_failure_steps"
    )
      .delete()
      .eq("card_id", cardId);

    if (deleteError) {
      console.error("saveFailureSteps delete error:", deleteError);
      return { error: "שגיאה במחיקת שלבי כישלון" };
    }

    if (validated.data.length > 0) {
      const insertRows = validated.data.map((row, i) => ({
        card_id: cardId,
        text_he: row.text_he,
        is_final: row.is_final,
        order_index: i,
      }));

      const { error: insertError } = await typedFrom(
        adminClient,
        "book_drill_card_failure_steps"
      ).insert(insertRows);

      if (insertError) {
        console.error("saveFailureSteps insert error:", insertError);
        return { error: "שגיאה בשמירת שלבי כישלון" };
      }
    }

    revalidatePath("/admin/book");
    revalidatePath("/dashboard/book");
    return { success: true };
  } catch (err) {
    console.error("saveFailureSteps error:", err);
    return { error: "שגיאה בשמירת שלבי כישלון" };
  }
}

// ---------------------------------------------------------------------------
// savePhases — delete-all phases (cascades phase_points) + insert phases+points
// ---------------------------------------------------------------------------

export async function savePhases(
  cardId: string,
  phases: PhaseRowInput[]
): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(cardId)) return { error: "מזהה כרטיס לא תקין" };

  const validated = phasesInputSchema.safeParse(phases);
  if (!validated.success) {
    return { error: "אימות נתונים נכשל" };
  }

  const adminClient = createAdminClient();

  try {
    // Delete all phases — cascades to book_drill_card_phase_points
    const { error: deleteError } = await typedFrom(
      adminClient,
      "book_drill_card_phases"
    )
      .delete()
      .eq("card_id", cardId);

    if (deleteError) {
      console.error("savePhases delete error:", deleteError);
      return { error: "שגיאה במחיקת שלבים" };
    }

    if (validated.data.length === 0) {
      return { success: true };
    }

    // Insert each phase, then insert its points
    for (let i = 0; i < validated.data.length; i++) {
      const phase = validated.data[i];

      const { data: newPhase, error: phaseInsertError } = (await typedFrom(
        adminClient,
        "book_drill_card_phases"
      )
        .insert({
          card_id: cardId,
          number: phase.number ?? null,
          name_he: phase.name_he,
          subtitle_he: phase.subtitle_he ?? null,
          drill_note_he: phase.drill_note_he ?? null,
          order_index: i,
        })
        .select("id")
        .single()) as { data: { id: string } | null; error: unknown };

      if (phaseInsertError || !newPhase) {
        console.error("savePhases phase insert error:", phaseInsertError);
        return { error: "שגיאה בשמירת שלב" };
      }

      if (phase.points.length > 0) {
        const pointRows = phase.points.map((pt, j) => ({
          phase_id: newPhase.id,
          text_he: pt.text_he,
          order_index: j,
        }));

        const { error: pointsInsertError } = await typedFrom(
          adminClient,
          "book_drill_card_phase_points"
        ).insert(pointRows);

        if (pointsInsertError) {
          console.error("savePhases points insert error:", pointsInsertError);
          return { error: "שגיאה בשמירת נקודות שלב" };
        }
      }
    }

    revalidatePath("/admin/book");
    revalidatePath("/dashboard/book");
    return { success: true };
  } catch (err) {
    console.error("savePhases error:", err);
    return { error: "שגיאה בשמירת שלבים" };
  }
}

// ---------------------------------------------------------------------------
// saveMetrics — delete-all + insert submitted set
// ---------------------------------------------------------------------------

export async function saveMetrics(
  cardId: string,
  rows: MetricRowInput[]
): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(cardId)) return { error: "מזהה כרטיס לא תקין" };

  const validated = metricsInputSchema.safeParse(rows);
  if (!validated.success) {
    return { error: "אימות נתונים נכשל" };
  }

  const adminClient = createAdminClient();

  try {
    const { error: deleteError } = await typedFrom(
      adminClient,
      "book_drill_card_metrics"
    )
      .delete()
      .eq("card_id", cardId);

    if (deleteError) {
      console.error("saveMetrics delete error:", deleteError);
      return { error: "שגיאה במחיקת מדדים" };
    }

    if (validated.data.length > 0) {
      const insertRows = validated.data.map((row, i) => ({
        card_id: cardId,
        label_he: row.label_he,
        before_he: row.before_he ?? null,
        target_he: row.target_he ?? null,
        order_index: i,
      }));

      const { error: insertError } = await typedFrom(
        adminClient,
        "book_drill_card_metrics"
      ).insert(insertRows);

      if (insertError) {
        console.error("saveMetrics insert error:", insertError);
        return { error: "שגיאה בשמירת מדדים" };
      }
    }

    revalidatePath("/admin/book");
    revalidatePath("/dashboard/book");
    return { success: true };
  } catch (err) {
    console.error("saveMetrics error:", err);
    return { error: "שגיאה בשמירת מדדים" };
  }
}
