/**
 * The Assessments the goal proposals job claims tonight, through the service
 * role: the recent live Assessments of the Weekly report's Trainees, when each
 * last changed (its rating snapshot), and what the job did with it before
 * (`goal_proposal_checks`). The pure `dueAssessments` decides; this file only
 * reads. A failed read throws with the table's name.
 */
import "server-only";

import { must, unique, type Db } from "@/features/weekly-reports/lib/queries/read";
import { readInChunks } from "@/lib/supabase/in-chunks";
import { addDays } from "@/lib/utils/iso-date";
import { DUE_WINDOW_DAYS, dueAssessments, type CheckState, type DueItem, type DueRow } from "../due";
import { datedAssessment, type DatedAssessment } from "./history";

/** The live Assessments of these Trainees dated from DUE_WINDOW_DAYS back (a row with no date left out). */
async function readRecentAssessments(
  db: Db,
  traineeIds: readonly string[],
  today: string,
): Promise<DatedAssessment[]> {
  const rows = must(
    "player_assessments",
    await readInChunks(traineeIds, "user_id", () =>
      db
        .from("player_assessments")
        .select("id, user_id, assessment_date, created_at")
        .is("deleted_at", null)
        .gte("assessment_date", addDays(today, -DUE_WINDOW_DAYS))
        .order("id"),
    ),
  );
  return rows.flatMap((row) => {
    const dated = datedAssessment(row);
    return dated === null ? [] : [dated];
  });
}

/** Assessment id to its live rating snapshot's `computed_at`. */
async function readSnapshotTimes(db: Db, assessmentIds: readonly string[]): Promise<Map<string, string>> {
  const rows = must(
    "player_rating_snapshots",
    await readInChunks(assessmentIds, "assessment_id", () =>
      db
        .from("player_rating_snapshots")
        .select("id, assessment_id, computed_at")
        .is("deleted_at", null)
        .order("id"),
    ),
  );
  return new Map(rows.map((row) => [row.assessment_id, row.computed_at]));
}

/** Assessment id to the job's stored check of it. */
async function readChecks(db: Db, assessmentIds: readonly string[]): Promise<Map<string, CheckState>> {
  const rows = must(
    "goal_proposal_checks",
    await readInChunks(assessmentIds, "assessment_id", () =>
      db
        .from("goal_proposal_checks")
        .select("assessment_id, outcome, attempts, checked_at")
        .order("assessment_id"),
    ),
  );
  return new Map(
    rows.map((row) => [row.assessment_id, { outcome: row.outcome, attempts: row.attempts, checkedAt: row.checked_at }]),
  );
}

/**
 * When an Assessment last changed: its snapshot's `computed_at`, else its
 * `created_at`, else its own date at midnight UTC (a row with no stamp at all
 * counts as changed on its date).
 */
function changedAtOf(row: DatedAssessment, snapshots: ReadonlyMap<string, string>): string {
  return snapshots.get(row.id) ?? (row.createdAt || `${row.date}T00:00:00Z`);
}

/** The Assessments of these Trainees to claim tonight, oldest first (see `dueAssessments`). */
export async function loadDue(db: Db, traineeIds: readonly string[], today: string): Promise<DueItem[]> {
  const ids = unique(traineeIds);
  if (ids.length === 0) return [];
  const assessments = await readRecentAssessments(db, ids, today);
  if (assessments.length === 0) return [];
  const assessmentIds = assessments.map((row) => row.id);
  const [snapshots, checks] = await Promise.all([
    readSnapshotTimes(db, assessmentIds),
    readChecks(db, assessmentIds),
  ]);
  const rows: DueRow[] = assessments.map((row) => ({ ...row, changedAt: changedAtOf(row, snapshots) }));
  return dueAssessments(rows, checks, today);
}
