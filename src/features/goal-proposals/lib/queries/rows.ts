/**
 * The goal proposals job's writes, through the service role: claiming and
 * finishing an Assessment's check, saving the checked picks as proposals, and
 * expiring the open proposals that went stale.
 *
 * Every write that races another run or a person is conditional. A check is
 * claimed by one insert on its primary key or one update matching the outcome
 * and `checked_at` it was read with, so two runs never both claim it; an open
 * proposal is expired only while it is still `proposed`, so a decision staff
 * made meanwhile is never undone. A failed read or write throws with the
 * table's name.
 */
import "server-only";

import { must, unique, type Db } from "@/features/weekly-reports/lib/queries/read";
import { toJson } from "@/features/weekly-reports/lib/queries/stored";
import { chunk, readAllPages, readInChunks } from "@/lib/supabase/in-chunks";
import type { TablesInsert } from "@/types/database";
import { newestByTrainee, staleProposals, type DueItem, type OpenProposal } from "../due";
import type { CheckedPick } from "../guardrails";
import { datedAssessment, readOpenGoals } from "./history";

function writeError(table: string, what: string, message: string): Error {
  console.error(`[goal-proposals] ${table} ${what} failed:`, message);
  return new Error(`Goal proposals: ${table} ${what} failed`);
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * Claims a due Assessment for this run as `unfinished`. With no check yet,
 * one insert (a second run's insert fails on the primary key, 23505); with
 * one, one update matching the outcome and `checked_at` it was read with. One
 * rule for a retry and for a re-check after staff changed the Assessment.
 * `checked_at` is `readAt`, when the run started reading the Assessments, not
 * the time of the claim: an edit staff save while the run is going is then
 * after it, and the Assessment is looked at again on a later night.
 * False when another run claimed it first.
 */
export async function claimCheck(db: Db, item: DueItem, readAt: string): Promise<boolean> {
  if (item.previous === null) {
    const { error } = await db.from("goal_proposal_checks").insert({
      assessment_id: item.id,
      trainee_id: item.traineeId,
      outcome: "unfinished",
      attempts: 1,
      checked_at: readAt,
    });
    if (error?.code === "23505") return false;
    if (error) throw writeError("goal_proposal_checks", "claim", error.message);
    return true;
  }
  const { data, error } = await db
    .from("goal_proposal_checks")
    .update({ outcome: "unfinished", attempts: item.attempts, checked_at: readAt })
    .eq("assessment_id", item.id)
    .eq("outcome", item.previous.outcome)
    .eq("checked_at", item.previous.checkedAt)
    .select("assessment_id");
  if (error) throw writeError("goal_proposal_checks", "claim", error.message);
  return (data?.length ?? 0) > 0;
}

/** How a claimed check ended, with the model's name, prompt version and usage when it was asked. */
export interface CheckFinish {
  outcome: "proposed" | "no_candidates" | "none_picked";
  model?: string;
  promptVersion?: string;
  usage?: unknown;
}

/**
 * Finishes a check this run claimed. `checked_at` stays as the claim set it
 * (the run's `readAt`), so a change staff saved after the run read the data
 * is after it and is looked at again. A field not given is stored as null, so the row
 * describes this check and not an earlier attempt's request.
 */
export async function finishCheck(db: Db, assessmentId: string, values: CheckFinish): Promise<void> {
  const { data, error } = await db
    .from("goal_proposal_checks")
    .update({
      outcome: values.outcome,
      model: values.model ?? null,
      prompt_version: values.promptVersion ?? null,
      usage: values.usage === undefined ? null : toJson(values.usage),
    })
    .eq("assessment_id", assessmentId)
    .eq("outcome", "unfinished")
    .select("assessment_id");
  if (error) throw writeError("goal_proposal_checks", "finish", error.message);
  if ((data?.length ?? 0) === 0) {
    console.error(`[goal-proposals] check of assessment ${assessmentId} was not unfinished; left as it was`);
  }
}

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

/** The proposals of an Assessment, any status. Read after the claim, so a crashed run's set is found. */
export async function savedProposalCount(db: Db, assessmentId: string): Promise<number> {
  const { count, error } = await db
    .from("goal_proposals")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId);
  if (error) throw writeError("goal_proposals", "count", error.message);
  return count ?? 0;
}

export interface SaveProposalsInput {
  assessmentId: string;
  traineeId: string;
  /** The Trainee's Weekly report branches; staff scope filters on them. */
  branchIds: readonly string[];
  picks: readonly CheckedPick[];
  model: string;
  promptVersion: string;
}

/** A pick as a row: the baseline and target are the code's candidate, never a model field. */
function toInsert(input: SaveProposalsInput, pick: CheckedPick): TablesInsert<"goal_proposals"> {
  return {
    assessment_id: input.assessmentId,
    trainee_id: input.traineeId,
    branch_ids: [...input.branchIds],
    metric_key: pick.candidate.metric_key,
    rank: pick.rank,
    baseline_value: pick.candidate.value,
    target_value: pick.candidate.target,
    facts: toJson(pick.candidate),
    reason: pick.reason,
    drill_ids: [...pick.drillIds],
    problems: toJson(pick.problems),
    model: input.model,
    prompt_version: input.promptVersion,
  };
}

/** The Trainee's open proposals of other Assessments become expired. Returns how many. */
async function expireOthers(db: Db, traineeId: string, assessmentId: string, now: string): Promise<number> {
  const { data, error } = await db
    .from("goal_proposals")
    .update({ status: "expired", decided_at: now })
    .eq("trainee_id", traineeId)
    .eq("status", "proposed")
    .neq("assessment_id", assessmentId)
    .select("id");
  if (error) throw writeError("goal_proposals", "expire", error.message);
  return data?.length ?? 0;
}

/**
 * Saves an Assessment's checked picks. The Trainee's open proposals of other
 * Assessments expire first (a target against older values never waits for a
 * person, and the open-per-metric index would refuse the new rows). The rows
 * go in one statement that leaves an existing (assessment, metric) row as it
 * is, a second guard behind `stepBeforeModel`, which never sends an
 * Assessment that has proposals to the model again. Returns the rows inserted.
 */
export async function saveProposals(db: Db, input: SaveProposalsInput): Promise<number> {
  if (input.picks.length === 0) return 0;
  await expireOthers(db, input.traineeId, input.assessmentId, new Date().toISOString());
  const { data, error } = await db
    .from("goal_proposals")
    .upsert(
      input.picks.map((pick) => toInsert(input, pick)),
      { onConflict: "assessment_id,metric_key", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw writeError("goal_proposals", "insert", error.message);
  return data?.length ?? 0;
}

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

/** Every open proposal, with whether its Assessment was soft-deleted. */
async function readOpenProposals(db: Db): Promise<OpenProposal[]> {
  const rows = must(
    "goal_proposals",
    await readAllPages(() =>
      db
        .from("goal_proposals")
        .select(
          "id, trainee_id, assessment_id, metric_key, created_at, assessment:player_assessments!goal_proposals_assessment_id_fkey(deleted_at)",
        )
        .eq("status", "proposed")
        .order("id"),
    ),
  );
  return rows.map((row) => ({
    id: row.id,
    traineeId: row.trainee_id,
    assessmentId: row.assessment_id,
    metricKey: row.metric_key,
    createdAt: row.created_at,
    assessmentDeleted: !row.assessment || row.assessment.deleted_at !== null,
  }));
}

/** Trainee id to the id of their newest live Assessment (a row with no date left out). */
async function readNewestLive(db: Db, traineeIds: readonly string[]): Promise<Map<string, string>> {
  const rows = must(
    "player_assessments",
    await readInChunks(traineeIds, "user_id", () =>
      db
        .from("player_assessments")
        .select("id, user_id, assessment_date, created_at")
        .is("deleted_at", null)
        .order("id"),
    ),
  );
  return newestByTrainee(
    rows.flatMap((row) => {
      const dated = datedAssessment(row);
      return dated === null ? [] : [dated];
    }),
  );
}

/** These proposals become expired, each only while it is still open. Returns how many. */
async function expireIds(db: Db, ids: readonly string[]): Promise<number> {
  const now = new Date().toISOString();
  let expired = 0;
  for (const slice of chunk(ids)) {
    const { data, error } = await db
      .from("goal_proposals")
      .update({ status: "expired", decided_at: now })
      .in("id", slice)
      .eq("status", "proposed")
      .select("id");
    if (error) throw writeError("goal_proposals", "expire", error.message);
    expired += data?.length ?? 0;
  }
  return expired;
}

/**
 * Expires the open proposals that went stale (`staleProposals`): older than
 * 30 days, on a metric that got an open Goal another way, on a soft-deleted
 * Assessment, or on an Assessment that is no longer the Trainee's newest live
 * one. Needs neither a branch setting nor the model. Returns how many.
 */
export async function expireStale(db: Db, today: string): Promise<number> {
  const open = await readOpenProposals(db);
  if (open.length === 0) return 0;
  const traineeIds = unique(open.map((proposal) => proposal.traineeId));
  const [goals, newest] = await Promise.all([readOpenGoals(db, traineeIds), readNewestLive(db, traineeIds)]);
  const openGoals = new Set(
    [...goals].flatMap(([traineeId, metrics]) => metrics.map((metric) => `${traineeId}:${metric}`)),
  );
  const stale = staleProposals(open, openGoals, newest, today);
  return stale.length === 0 ? 0 : expireIds(db, stale);
}
