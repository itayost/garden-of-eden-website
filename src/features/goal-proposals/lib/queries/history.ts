/**
 * What the goal proposals job reads once a run, through the service role: the
 * academy's Assessment history with every Trainee's age group inputs (for the
 * group bars and the targets), and, for the Trainees with a due Assessment,
 * what keeps a metric or a drill out (open Goals, recent rejections, drills
 * done) and the sensitive entries that mark their proposals for staff.
 *
 * Whole-table reads page past the 1000-row cap ordered by id; reads keyed by
 * Trainee ids go through readInChunks. A failed read throws with the table's
 * name: a job that sets targets from half the history is worse than one that
 * stops and logs.
 */
import "server-only";

import { readDrillsDone } from "@/features/development-book/lib/queries/drill-pool";
import { GOAL_METRICS, type GoalMetric } from "@/features/goals/lib/config/goal-config";
import type { HoldReason } from "@/features/weekly-reports/lib/fact-sheet/types";
import { groupBy, must, unique, type Db } from "@/features/weekly-reports/lib/queries/read";
import { readShiftReports, readTags } from "@/features/weekly-reports/lib/queries/week-reads";
import { newSensitiveHolds, sensitiveHoldsNow } from "@/features/weekly-reports/lib/sensitive-recheck";
import { readAllPages, readInChunks } from "@/lib/supabase/in-chunks";
import { addDays } from "@/lib/utils/iso-date";
import { israelDateStr } from "@/lib/utils/israel-time";
import type { Tables } from "@/types/database";
import { REJECTED_QUIET_DAYS, SENSITIVE_LOOKBACK_DAYS } from "../due";
import type { MetricRow, ProfileAges } from "../gaps";
import { HISTORY_DAYS } from "../targets";

/** An Assessment's id, Trainee, date and creation stamp, then the 18 Goal metric columns. */
export const GOAL_METRIC_SELECT =
  "id, user_id, assessment_date, created_at, sprint_5m, sprint_10m, sprint_20m, jump_2leg_distance, jump_2leg_height, jump_right_leg, jump_left_leg, blaze_spot_time, flexibility_ankle, flexibility_knee, flexibility_hip, kick_power_right_foot, kick_power_left_foot, shuffle_10m, sprint_10m_h, sprint_10m_h_ball, envelope, envelope_ball";

/** A Trainee's profile as the age group and drill rules read it. */
export type HistoryProfile = ProfileAges & { position: string | null };

type AssessmentStamps = Pick<Tables<"player_assessments">, "id" | "user_id" | "assessment_date" | "created_at">;
type HistoryAssessment = Pick<Tables<"player_assessments">, keyof AssessmentStamps | GoalMetric>;

/** An Assessment as the date rules read it. */
export interface DatedAssessment {
  id: string;
  traineeId: string;
  date: string;
  createdAt: string;
}

/**
 * The date rules' view of an Assessment, or null when it has no date. A
 * missing `created_at` becomes "", so the row loses a same-date tie to one
 * that has it. loadHistory, loadDue and expireStale all read rows through it,
 * so they agree on which Assessment is the newest.
 */
export function datedAssessment(row: AssessmentStamps): DatedAssessment | null {
  if (row.assessment_date === null) return null;
  return { id: row.id, traineeId: row.user_id, date: row.assessment_date, createdAt: row.created_at ?? "" };
}

function metricValue(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toMetricRow(row: HistoryAssessment): MetricRow | null {
  const dated = datedAssessment(row);
  if (dated === null) return null;
  const values: Partial<Record<GoalMetric, number | null>> = Object.fromEntries(
    GOAL_METRICS.map((metric) => [metric, metricValue(row[metric])]),
  );
  return { id: dated.id, userId: dated.traineeId, date: dated.date, createdAt: dated.createdAt, values };
}

/**
 * Every live Trainee's age group inputs and position, and every live
 * Assessment of the last HISTORY_DAYS (a row with no date is left out).
 */
export async function loadHistory(
  db: Db,
  today: string,
): Promise<{ profiles: Map<string, HistoryProfile>; rows: MetricRow[] }> {
  const [profiles, assessments] = await Promise.all([
    readAllPages(() =>
      db
        .from("profiles")
        .select("id, birthdate, position, age_group_override, age_group_override_until")
        .eq("role", "trainee")
        .is("deleted_at", null)
        .order("id"),
    ),
    readAllPages(() =>
      db
        .from("player_assessments")
        .select(GOAL_METRIC_SELECT)
        .is("deleted_at", null)
        .gte("assessment_date", addDays(today, -HISTORY_DAYS))
        .order("id"),
    ),
  ]);
  return {
    profiles: new Map(must("profiles", profiles).map((profile) => [profile.id, profile])),
    rows: must("player_assessments", assessments).flatMap((row) => {
      const metricRow = toMetricRow(row);
      return metricRow === null ? [] : [metricRow];
    }),
  };
}

/** What keeps a metric or a drill out for each Trainee, and what marks their proposals. */
export interface TraineeContext {
  /** Trainee id to the metrics of their open Goals. */
  openGoals: Map<string, string[]>;
  /** Trainee id to the metrics of proposals rejected in the last REJECTED_QUIET_DAYS. */
  rejected: Map<string, { metricKey: string; decidedOn: string }[]>;
  /** Trainee id to the drills marked done in the last 30 days. */
  done: Map<string, Set<string>>;
  /** Trainee id to its sensitive Holds (the texts only, never the entry's words). */
  sensitive: Map<string, HoldReason[]>;
}

/** Trainee id to the metrics of their open Goals (`achieved_at` null). */
export async function readOpenGoals(db: Db, traineeIds: readonly string[]): Promise<Map<string, string[]>> {
  const rows = must(
    "player_goals",
    await readInChunks(traineeIds, "user_id", () =>
      db.from("player_goals").select("id, user_id, metric_key").is("achieved_at", null).order("id"),
    ),
  );
  return new Map(
    [...groupBy(rows, (row) => row.user_id)].map(([id, goals]) => [id, unique(goals.map((goal) => goal.metric_key))]),
  );
}

/**
 * Proposals rejected from the Israel day REJECTED_QUIET_DAYS back. The read
 * starts a UTC day earlier, since Israel runs ahead of UTC; excludedMetrics
 * keeps the exact days.
 */
async function readRejected(
  db: Db,
  traineeIds: readonly string[],
  today: string,
): Promise<Map<string, { metricKey: string; decidedOn: string }[]>> {
  const from = addDays(today, -REJECTED_QUIET_DAYS);
  const rows = must(
    "goal_proposals",
    await readInChunks(traineeIds, "trainee_id", () =>
      db
        .from("goal_proposals")
        .select("id, trainee_id, metric_key, decided_at")
        .eq("status", "rejected")
        .gte("decided_at", `${addDays(from, -1)}T00:00:00Z`)
        .order("id"),
    ),
  );
  const dated = rows.flatMap((row) =>
    row.decided_at === null
      ? []
      : [{ traineeId: row.trainee_id, metricKey: row.metric_key, decidedOn: israelDateStr(row.decided_at) }],
  );
  return new Map(
    [...groupBy(dated, (row) => row.traineeId)].map(([id, list]) => [
      id,
      list.map(({ metricKey, decidedOn }) => ({ metricKey, decidedOn })),
    ]),
  );
}

/**
 * The sensitive Holds of the SENSITIVE_LOOKBACK_DAYS up to today: a sensitive
 * Shift report entry or a caution Quick tag naming the Trainee, through the
 * Weekly report's own rules and texts, each text once (`newSensitiveHolds`
 * against none stored). A Trainee with none is not in the map.
 */
async function readSensitive(
  db: Db,
  traineeIds: readonly string[],
  today: string,
): Promise<Map<string, HoldReason[]>> {
  const range = { from: addDays(today, -(SENSITIVE_LOOKBACK_DAYS - 1)), to: today };
  const [reports, tags] = await Promise.all([readShiftReports(db, range), readTags(db, traineeIds, range)]);
  return new Map(
    traineeIds
      .map((id) => [id, newSensitiveHolds([], sensitiveHoldsNow(reports, tags.get(id) ?? [], id))] as const)
      .filter(([, holds]) => holds.length > 0),
  );
}

/** Open Goals, recent rejections, drills done in the last 30 days and sensitive Holds of these Trainees. */
export async function loadTraineeContext(
  db: Db,
  traineeIds: readonly string[],
  today: string,
): Promise<TraineeContext> {
  const ids = unique(traineeIds);
  if (ids.length === 0) {
    return { openGoals: new Map(), rejected: new Map(), done: new Map(), sensitive: new Map() };
  }
  const [openGoals, rejected, done, sensitive] = await Promise.all([
    readOpenGoals(db, ids),
    readRejected(db, ids, today),
    readDrillsDone(db, ids, addDays(today, -29), today),
    readSensitive(db, ids, today),
  ]);
  return { openGoals, rejected, done, sensitive };
}
