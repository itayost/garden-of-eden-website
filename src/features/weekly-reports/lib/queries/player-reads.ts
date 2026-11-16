/**
 * Who the Trainees are and where they stand, through the service role: the
 * profile columns the Fact sheet uses, branch names, Assessments, nutrition
 * measurements, the dietitian's note, open Goals and the next game. Reads keyed
 * by Trainee ids go through readInChunks; a failed read throws.
 */
import "server-only";

import type { GroupStats } from "@/lib/assessment-to-rating";
import { parseGender, type Gender } from "@/lib/profile/gender";
import { readInChunks } from "@/lib/supabase/in-chunks";
import { fetchGroupStats } from "@/lib/utils/fetch-benchmarks";
import {
  BODY_STRUCTURE_OPTIONS,
  COORDINATION_OPTIONS,
  LEG_POWER_OPTIONS,
  type PlayerAssessment,
} from "@/types/assessment";
import type { PlayerGoalRow } from "@/types/database";
import type { NutritionMeasurement } from "../fact-sheet/types";
import { groupBy, must, unique, type Db } from "./read";

/** The profile columns the Fact sheet reads; never the name or a phone. */
export interface ProfileRead {
  gender: Gender | null;
  birthdate: string | null;
  position: string | null;
  age_group_override: string | null;
  age_group_override_until: string | null;
}

export async function readProfiles(db: Db, ids: readonly string[]): Promise<Map<string, ProfileRead>> {
  const rows = must(
    "profiles",
    await readInChunks(ids, "id", () =>
      db
        .from("profiles")
        .select("id, gender, birthdate, position, age_group_override, age_group_override_until")
        .order("id"),
    ),
  );
  return new Map(rows.map((row) => [row.id, { ...row, gender: parseGender(row.gender) }]));
}

export async function readBranchNames(db: Db, branchIds: readonly string[]): Promise<Map<string, string>> {
  const rows = must(
    "branches",
    await readInChunks(unique(branchIds), "id", () => db.from("branches").select("id, name_he").order("id")),
  );
  return new Map(rows.map((row) => [row.id, row.name_he]));
}

/** The latest of a Trainee's records in the week, and the one before it. */
export interface InWeekPair<T> {
  inWeek: T | null;
  previous: T | null;
}

/**
 * From records dated up to the week's end, newest first: the newest when it
 * falls in the week, and the next one back.
 */
function latestInWeek<T>(newestFirst: readonly T[], dateOf: (row: T) => string, weekStart: string): InWeekPair<T> {
  const [latest, previous] = newestFirst;
  if (latest === undefined || dateOf(latest) < weekStart) return { inWeek: null, previous: null };
  return { inWeek: latest, previous: previous ?? null };
}

/** Newest first by date, then by when the row was made. */
function newestByDate<T>(dateOf: (row: T) => string, createdOf: (row: T) => string) {
  return (a: T, b: T): number =>
    dateOf(b).localeCompare(dateOf(a)) || createdOf(b).localeCompare(createdOf(a));
}

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

const ASSESSMENT_SELECT =
  "id, user_id, assessment_date, created_at, sprint_5m, sprint_10m, sprint_20m, jump_2leg_distance, jump_right_leg, jump_left_leg, jump_2leg_height, blaze_spot_time, flexibility_ankle, flexibility_knee, flexibility_hip, coordination, leg_power_technique, body_structure, kick_power_kaiser, kick_power_right_foot, kick_power_left_foot, kick_power_machine_pct, shuffle_10m, sprint_10m_h, sprint_10m_h_ball, envelope, envelope_ball";

function optionOf<T extends string>(options: readonly { value: T }[], value: string | null): T | null {
  return options.find((option) => option.value === value)?.value ?? null;
}

/**
 * An Assessment row as the comparison and rating code take it. Only the
 * metrics are read; the written notes and who assessed stay empty, so they
 * can never reach the Fact sheet.
 */
function toAssessment(
  row: Omit<
    PlayerAssessment,
    | "coordination"
    | "leg_power_technique"
    | "body_structure"
    | "concentration_notes"
    | "decision_making_notes"
    | "work_ethic_notes"
    | "recovery_notes"
    | "nutrition_notes"
    | "assessed_by"
    | "notes"
    | "created_at"
  > & {
    coordination: string | null;
    leg_power_technique: string | null;
    body_structure: string | null;
    created_at: string | null;
  },
): PlayerAssessment {
  return {
    ...row,
    coordination: optionOf(COORDINATION_OPTIONS, row.coordination),
    leg_power_technique: optionOf(LEG_POWER_OPTIONS, row.leg_power_technique),
    body_structure: optionOf(BODY_STRUCTURE_OPTIONS, row.body_structure),
    concentration_notes: null,
    decision_making_notes: null,
    work_ethic_notes: null,
    recovery_notes: null,
    nutrition_notes: null,
    assessed_by: null,
    notes: null,
    created_at: row.created_at ?? "",
  };
}

/** Each Trainee's newest Assessment in the week and the one before it. */
export async function readAssessments(
  db: Db,
  traineeIds: readonly string[],
  weekStart: string,
  weekEnd: string,
): Promise<Map<string, InWeekPair<PlayerAssessment>>> {
  const rows = must(
    "player_assessments",
    await readInChunks(traineeIds, "user_id", () =>
      db
        .from("player_assessments")
        .select(ASSESSMENT_SELECT)
        .is("deleted_at", null)
        .not("assessment_date", "is", null)
        .lte("assessment_date", weekEnd)
        .order("id"),
    ),
  );
  const dated = rows.flatMap((row) => {
    const date = row.assessment_date;
    return date === null ? [] : [toAssessment({ ...row, assessment_date: date })];
  });
  const sort = newestByDate<PlayerAssessment>((a) => a.assessment_date, (a) => a.created_at);
  return new Map(
    [...groupBy(dated, (a) => a.user_id)].map(([traineeId, list]) => [
      traineeId,
      latestInWeek([...list].sort(sort), (a) => a.assessment_date, weekStart),
    ]),
  );
}

/** The age group benchmarks, read once per group; a group with too few players has none. */
export async function readGroupStats(
  db: Db,
  ageGroupIds: readonly string[],
): Promise<Map<string, GroupStats | null>> {
  const ids = unique(ageGroupIds);
  const stats = await Promise.all(ids.map((id) => fetchGroupStats(db, id)));
  return new Map(ids.map((id, i) => [id, stats[i] ?? null]));
}

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

/** Each Trainee's newest measurement in the week and the one before it. */
export async function readMeasurements(
  db: Db,
  traineeIds: readonly string[],
  weekStart: string,
  weekEnd: string,
): Promise<Map<string, InWeekPair<NutritionMeasurement>>> {
  const rows = must(
    "nutrition_measurements",
    await readInChunks(traineeIds, "user_id", () =>
      db
        .from("nutrition_measurements")
        .select("id, user_id, created_at, measurement_date, weight_kg, height_cm, bmi, bmi_percentile, height_percentile")
        .is("deleted_at", null)
        .lte("measurement_date", weekEnd)
        .order("id"),
    ),
  );
  const sort = newestByDate<(typeof rows)[number]>((m) => m.measurement_date, (m) => m.created_at);
  return new Map(
    [...groupBy(rows, (m) => m.user_id)].map(([traineeId, list]) => {
      const pair = latestInWeek([...list].sort(sort), (m) => m.measurement_date, weekStart);
      const pick = (m: (typeof rows)[number] | null): NutritionMeasurement | null =>
        m === null
          ? null
          : {
              measurement_date: m.measurement_date,
              weight_kg: m.weight_kg,
              height_cm: m.height_cm,
              bmi: m.bmi,
              bmi_percentile: m.bmi_percentile,
              height_percentile: m.height_percentile,
            };
      return [traineeId, { inWeek: pick(pair.inWeek), previous: pick(pair.previous) }];
    }),
  );
}

/** The live dietitian recommendation of each Trainee (the newest when there are two). */
export async function readDietitianNotes(db: Db, traineeIds: readonly string[]): Promise<Map<string, string>> {
  const rows = must(
    "nutrition_recommendations",
    await readInChunks(traineeIds, "user_id", () =>
      db
        .from("nutrition_recommendations")
        .select("id, user_id, recommendation_text, created_at, updated_at")
        .is("deleted_at", null)
        .order("id"),
    ),
  );
  const stamp = (r: (typeof rows)[number]) => r.updated_at ?? r.created_at ?? "";
  return new Map(
    [...groupBy(rows, (r) => r.user_id)].map(([traineeId, list]) => {
      const newest = list.reduce((a, b) => (stamp(b) > stamp(a) ? b : a));
      return [traineeId, newest.recommendation_text];
    }),
  );
}

// ---------------------------------------------------------------------------
// Goals and the next game
// ---------------------------------------------------------------------------

export async function readOpenGoals(db: Db, traineeIds: readonly string[]): Promise<Map<string, PlayerGoalRow[]>> {
  const rows = must(
    "player_goals",
    await readInChunks(traineeIds, "user_id", () =>
      db.from("player_goals").select("*").is("achieved_at", null).order("id"),
    ),
  );
  return groupBy(rows, (goal) => goal.user_id);
}

/** Each Trainee's nearest game on or after `today`. */
export async function readNextGames(
  db: Db,
  traineeIds: readonly string[],
  today: string,
): Promise<Map<string, { date: string; opponent: string }>> {
  const rows = must(
    "trainee_next_games",
    await readInChunks(traineeIds, "user_id", () =>
      db.from("trainee_next_games").select("id, user_id, game_date, opponent").gte("game_date", today).order("id"),
    ),
  );
  return new Map(
    [...groupBy(rows, (g) => g.user_id)].map(([traineeId, games]) => {
      const nearest = games.reduce((a, b) => (b.game_date < a.game_date ? b : a));
      return [traineeId, { date: nearest.game_date, opponent: nearest.opponent }];
    }),
  );
}
