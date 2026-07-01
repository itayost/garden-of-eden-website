"use server";

import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import { deriveAgeGroup } from "../age-group";
import { isParameterVisible } from "../filtering";
import type {
  BookCategoryWithParameters,
  BookParameterWithChildren,
  BookDrill,
  BookMuscle,
  BookAgeRow,
  BookDrillCard,
  CanonicalPosition,
  DrillProgressMap,
  AgeGroup,
  FailureStep,
  CardPhase,
  CardPhasePoint,
  CardMetric,
} from "../types";

// --- Raw DB row shapes (snake_case) ---

interface RawCategory {
  id: string;
  slug: string;
  name_he: string;
  icon: string | null;
  order_index: number;
}

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
  age_group: AgeGroup;
  what_he: string | null;
  metric_value_he: string | null;
  recovery_he: string | null;
  order_index: number;
}

interface RawDrillProgress {
  drill_id: string;
}

interface RawMuscle {
  id: string;
  name_he: string;
  emoji: string | null;
}

interface RawDrillMuscleLink {
  drill_id: string;
  muscle_id: string;
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

// --- Mappers: snake_case → camelCase ---

function mapMuscle(row: RawMuscle): BookMuscle {
  return {
    id: row.id,
    nameHe: row.name_he,
    emoji: row.emoji,
  };
}

function mapDrill(row: RawDrill, muscles: BookMuscle[] = []): BookDrill {
  return {
    id: row.id,
    parameterId: row.parameter_id,
    slug: row.slug,
    nameEn: row.name_en,
    nameHe: row.name_he,
    muscleHe: row.muscle_he,
    muscles,
    muscleIds: muscles.map((m) => m.id),
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
    ageGroup: row.age_group,
    whatHe: row.what_he,
    metricValueHe: row.metric_value_he,
    recoveryHe: row.recovery_he,
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

// --- getBookTree ---

export async function getBookTree(
  opts: { showAll?: boolean } = {}
): Promise<{
  categories: BookCategoryWithParameters[];
  ageGroup: AgeGroup | null;
  position: string | null;
  doneMap: DrillProgressMap;
}> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("position, birthdate")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const position = (profile?.position as string | null) ?? null;
  const ageGroup = deriveAgeGroup(profile?.birthdate ?? null);

  const [catsResult, paramsResult, positionsResult, drillsResult, ageRowsResult, progressResult, musclesResult, drillMuscleLinksResult] =
    await Promise.all([
      typedFrom(supabase, "book_categories").select("*").order("order_index") as Promise<{
        data: RawCategory[] | null;
      }>,
      typedFrom(supabase, "book_parameters").select("*").order("order_index") as Promise<{
        data: RawParameter[] | null;
      }>,
      typedFrom(supabase, "book_parameter_positions").select("*") as Promise<{
        data: RawParameterPosition[] | null;
      }>,
      typedFrom(supabase, "book_drills").select("*").order("order_index") as Promise<{
        data: RawDrill[] | null;
      }>,
      typedFrom(supabase, "book_age_rows").select("*").order("order_index") as Promise<{
        data: RawAgeRow[] | null;
      }>,
      user
        ? (typedFrom(supabase, "book_drill_progress")
            .select("drill_id")
            .eq("user_id", user.id) as Promise<{ data: RawDrillProgress[] | null }>)
        : Promise.resolve({ data: [] as RawDrillProgress[] }),
      typedFrom(supabase, "book_muscles").select("id, name_he, emoji") as Promise<{
        data: RawMuscle[] | null;
      }>,
      typedFrom(supabase, "book_drill_muscles").select("drill_id, muscle_id") as Promise<{
        data: RawDrillMuscleLink[] | null;
      }>,
    ]);

  const rawCategories: RawCategory[] = catsResult.data ?? [];
  const rawParameters: RawParameter[] = paramsResult.data ?? [];
  const rawPositions: RawParameterPosition[] = positionsResult.data ?? [];
  const rawDrills: RawDrill[] = drillsResult.data ?? [];
  const rawAgeRows: RawAgeRow[] = ageRowsResult.data ?? [];
  const rawProgress: RawDrillProgress[] = progressResult.data ?? [];
  const rawMuscles: RawMuscle[] = musclesResult.data ?? [];
  const rawDrillMuscleLinks: RawDrillMuscleLink[] = drillMuscleLinksResult.data ?? [];

  // Build muscle lookup map by id
  const muscleById = rawMuscles.reduce<Map<string, BookMuscle>>((acc, row) => {
    acc.set(row.id, mapMuscle(row));
    return acc;
  }, new Map());

  // Build muscles-per-drill map
  const musclesByDrill = rawDrillMuscleLinks.reduce<Map<string, BookMuscle[]>>((acc, link) => {
    const muscle = muscleById.get(link.muscle_id);
    if (!muscle) return acc;
    const existing = acc.get(link.drill_id) ?? [];
    acc.set(link.drill_id, [...existing, muscle]);
    return acc;
  }, new Map());

  // Build doneMap
  const doneMap: DrillProgressMap = Object.fromEntries(
    rawProgress.map((r) => [r.drill_id, true] as const)
  );

  // Group positions by parameter_id
  const positionsByParam = rawPositions.reduce<Record<string, CanonicalPosition[]>>(
    (acc, row) => {
      const existing = acc[row.parameter_id] ?? [];
      return { ...acc, [row.parameter_id]: [...existing, row.position as CanonicalPosition] };
    },
    {}
  );

  // Group drills by parameter_id (already ordered by order_index from DB)
  const drillsByParam = rawDrills.reduce<Record<string, BookDrill[]>>((acc, row) => {
    const existing = acc[row.parameter_id] ?? [];
    return { ...acc, [row.parameter_id]: [...existing, mapDrill(row, musclesByDrill.get(row.id) ?? [])] };
  }, {});

  // Group age rows by parameter_id (already ordered from DB)
  const ageRowsByParam = rawAgeRows.reduce<Record<string, BookAgeRow[]>>((acc, row) => {
    const existing = acc[row.parameter_id] ?? [];
    return { ...acc, [row.parameter_id]: [...existing, mapAgeRow(row)] };
  }, {});

  const showAll = opts.showAll ?? false;

  // Assemble parameters per category
  const paramsByCategory = rawParameters.reduce<Record<string, BookParameterWithChildren[]>>(
    (acc, raw) => {
      const positions = positionsByParam[raw.id] ?? [];
      const paramPositions = { isAllPositions: raw.is_all_positions, positions };

      if (!showAll && !isParameterVisible(paramPositions, position)) {
        return acc;
      }

      const param: BookParameterWithChildren = {
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
        drills: drillsByParam[raw.id] ?? [],
        ageRows: ageRowsByParam[raw.id] ?? [],
      };

      const existing = acc[raw.category_id] ?? [];
      return { ...acc, [raw.category_id]: [...existing, param] };
    },
    {}
  );

  // Assemble categories (already ordered from DB)
  const categories: BookCategoryWithParameters[] = rawCategories.map((raw) => ({
    id: raw.id,
    slug: raw.slug,
    nameHe: raw.name_he,
    icon: raw.icon,
    orderIndex: raw.order_index,
    parameters: paramsByCategory[raw.id] ?? [],
  }));

  return { categories, ageGroup, position, doneMap };
}

// --- getDrillCard ---

export async function getDrillCard(
  drillId: string
): Promise<{ drill: BookDrill; card: BookDrillCard | null; isDone: boolean } | null> {
  if (!isValidUUID(drillId)) return null;

  const supabase = await createClient();

  // Load drill
  const { data: rawDrill } = (await typedFrom(supabase, "book_drills")
    .select("*")
    .eq("id", drillId)
    .maybeSingle()) as { data: RawDrill | null };

  if (!rawDrill) return null;

  // Load muscles and current user's progress for this drill in parallel
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  const [muscleLinksResult, allMusclesResult, progressResult] = await Promise.all([
    typedFrom(supabase, "book_drill_muscles")
      .select("drill_id, muscle_id")
      .eq("drill_id", drillId) as Promise<{ data: RawDrillMuscleLink[] | null }>,
    typedFrom(supabase, "book_muscles")
      .select("id, name_he, emoji") as Promise<{ data: RawMuscle[] | null }>,
    user
      ? (typedFrom(supabase, "book_drill_progress")
          .select("id")
          .eq("user_id", user.id)
          .eq("drill_id", drillId)
          .maybeSingle() as Promise<{ data: { id: string } | null }>)
      : Promise.resolve({ data: null }),
  ]);

  const isDone = progressResult.data !== null;

  const rawMusclesForDrill: RawMuscle[] = allMusclesResult.data ?? [];
  const rawMuscleLinks: RawDrillMuscleLink[] = muscleLinksResult.data ?? [];

  const muscleByIdForDrill = rawMusclesForDrill.reduce<Map<string, BookMuscle>>((acc, row) => {
    acc.set(row.id, mapMuscle(row));
    return acc;
  }, new Map());

  const drillMuscles: BookMuscle[] = rawMuscleLinks.reduce<BookMuscle[]>((acc, link) => {
    const muscle = muscleByIdForDrill.get(link.muscle_id);
    return muscle ? [...acc, muscle] : acc;
  }, []);

  const drill = mapDrill(rawDrill, drillMuscles);

  // Load card
  const { data: rawCard } = (await typedFrom(supabase, "book_drill_cards")
    .select("*")
    .eq("drill_id", drillId)
    .maybeSingle()) as { data: RawDrillCard | null };

  if (!rawCard) {
    return { drill, card: null, isDone };
  }

  // Load card children in parallel
  const [stepsResult, phasesResult, metricsResult] = await Promise.all([
    typedFrom(supabase, "book_drill_card_failure_steps")
      .select("*")
      .eq("card_id", rawCard.id)
      .order("order_index") as Promise<{ data: RawFailureStep[] | null }>,
    typedFrom(supabase, "book_drill_card_phases")
      .select("*")
      .eq("card_id", rawCard.id)
      .order("order_index") as Promise<{ data: RawCardPhase[] | null }>,
    typedFrom(supabase, "book_drill_card_metrics")
      .select("*")
      .eq("card_id", rawCard.id)
      .order("order_index") as Promise<{ data: RawCardMetric[] | null }>,
  ]);

  const rawPhases: RawCardPhase[] = phasesResult.data ?? [];
  const phaseIds = rawPhases.map((p) => p.id);

  // Load phase points for all phases in one query (if any phases exist)
  const rawPhasePoints: RawCardPhasePoint[] =
    phaseIds.length > 0
      ? (
          (await typedFrom(supabase, "book_drill_card_phase_points")
            .select("*")
            .in("phase_id", phaseIds)
            .order("order_index")) as { data: RawCardPhasePoint[] | null }
        ).data ?? []
      : [];

  // Group phase points by phase_id
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

  return { drill, card, isDone };
}
