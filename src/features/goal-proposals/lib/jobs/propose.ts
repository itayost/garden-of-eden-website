/**
 * The nightly Goal proposals job. In order:
 *
 * 1. Stale open proposals expire (`expireStale`). That needs neither a branch
 *    setting nor the model, so it runs first, even while the key is unset or
 *    every branch is off.
 * 2. Only the Trainees the Weekly report takes (`reportBranches`) get
 *    proposals; no branch on, nothing more to do.
 * 3. No ANTHROPIC_API_KEY: logged, and only the writing is skipped.
 * 4. The due Assessments (`loadDue`); the history, the Development book and
 *    the due Trainees' context are read once for the run.
 * 5. Each Assessment is claimed, its candidates built in code, and the model
 *    asked once (`stepBeforeModel`, `stepAfterModel` decide). The stored
 *    baseline and target are always the candidate's (saveProposals), never a
 *    field of the model's answer.
 *
 * One Assessment's failure is logged and counted, and never stops the others;
 * its check stays unfinished and a later night retries it. A failure before
 * any claim (a read of the run's data) fails the run, with nothing claimed.
 */
import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { deriveAgeGroup } from "@/features/development-book/lib/age-group";
import {
  drillCandidatesFor,
  metricPositionFit,
  type DrillPool,
  type PositionFit,
} from "@/features/development-book/lib/drill-candidates";
import { loadDrillPool } from "@/features/development-book/lib/queries/drill-pool";
import { GOAL_METRICS } from "@/features/goals/lib/config/goal-config";
import type { PhysicalMetricKey } from "@/features/goals/types";
import { loadAudienceCandidates } from "@/features/surveys/lib/queries";
import { reportBranches, type ReportSetting } from "@/features/weekly-reports/lib/audience";
import { runUntil } from "@/features/weekly-reports/lib/jobs/run-until";
import { unique, type Db } from "@/features/weekly-reports/lib/queries/read";
import { loadReportSettings } from "@/features/weekly-reports/lib/queries/settings";
import { anthropicClient, JOB_LIMITS } from "@/features/weekly-reports/lib/writer/client";
import { writerModel, type WriterModel } from "@/features/weekly-reports/lib/writer/request";
import { resolveAgeGroup } from "@/lib/age-group-override";
import { excludedMetrics, OFFERED_DRILLS_PER_GOAL, proposalCandidates, type CandidateFacts } from "../candidates";
import type { DueItem } from "../due";
import { findGaps, groupMetrics, type GroupMetric, type MetricRow } from "../gaps";
import { loadDue } from "../queries/due";
import { loadHistory, loadTraineeContext, type HistoryProfile, type TraineeContext } from "../queries/history";
import { claimCheck, expireStale, finishCheck, saveProposals, savedProposalCount } from "../queries/rows";
import { stepAfterModel, stepBeforeModel } from "../step";
import { historyByGroup } from "../targets";
import { GOAL_PROMPT_VERSION } from "../writer/guide";
import { proposalInput } from "../writer/request";
import { writeProposal } from "../writer/write";

const LOG = "[goal-proposals]";

/** Direct requests in flight at once. */
const CONCURRENCY = 4;

export interface ProposeResult {
  /** Open proposals that went stale and expired this run. */
  expired: number;
  /** Assessments due tonight. */
  due: number;
  /** Assessments whose proposals were saved. */
  proposed: number;
  /** Assessments that already had proposals from a run that failed before finishing; no request. */
  resumed: number;
  noCandidates: number;
  nonePicked: number;
  /** Failed requests and errors; the check stays unfinished for a later night. */
  failed: number;
  /** Claimed by another run first. */
  claimedElsewhere: number;
  /** Not started before the deadline; due again on the next run. */
  notStarted: number;
}

export interface ProposeSkipped {
  skipped: string;
  expired: number;
}

type Outcome = "proposed" | "resumed" | "noCandidates" | "nonePicked" | "failed" | "claimedElsewhere";

/** What every Assessment of the run reads, loaded once. */
interface RunData {
  client: Anthropic;
  model: WriterModel;
  today: string;
  /** When the run started reading the Assessments: every claim's `checked_at` (`claimCheck`). */
  readAt: string;
  /** Trainee id to its Weekly report branch ids. */
  branchesOf: ReadonlyMap<string, readonly string[]>;
  profiles: ReadonlyMap<string, HistoryProfile>;
  /** Assessment id to its metric values. */
  rows: ReadonlyMap<string, MetricRow>;
  /** Age group id to the group's bar per metric. */
  groups: ReadonlyMap<string, ReadonlyMap<PhysicalMetricKey, GroupMetric>>;
  /** Age group id to the history improvements per metric. */
  history: ReadonlyMap<string, ReadonlyMap<PhysicalMetricKey, readonly number[]>>;
  pool: DrillPool;
  context: TraineeContext;
}

const NO_GROUP: ReadonlyMap<PhysicalMetricKey, GroupMetric> = new Map();
const NO_HISTORY: ReadonlyMap<PhysicalMetricKey, readonly number[]> = new Map();
const NONE_DONE: ReadonlySet<string> = new Set();

// ---------------------------------------------------------------------------
// One Assessment
// ---------------------------------------------------------------------------

/** What the model is told about the Trainee (no name, no id), and the candidates. */
interface AssessmentCandidates {
  ageGroup: string | null;
  position: string | null;
  candidates: CandidateFacts[];
}

const NO_CANDIDATES: AssessmentCandidates = { ageGroup: null, position: null, candidates: [] };

/**
 * The candidates of one Assessment, all computed in code: the gaps against
 * the Trainee's age group today, leaving out metrics with an open Goal or a
 * recent rejection, each with a target and the drills of the Trainee's book
 * age group (at the Assessment's date) and position, not done lately. No
 * row, no profile or no age group gives none.
 */
function candidatesOf(run: RunData, item: DueItem): AssessmentCandidates {
  const row = run.rows.get(item.id);
  const profile = run.profiles.get(item.traineeId);
  const group = profile ? resolveAgeGroup(profile, run.today) : null;
  if (!row || !profile || !group) return NO_CANDIDATES;

  const who = {
    ageGroup: deriveAgeGroup(profile.birthdate, new Date(`${row.date}T12:00:00Z`)),
    position: profile.position,
  };
  const fits = new Map<string, PositionFit>(
    GOAL_METRICS.map((metric) => [metric, metricPositionFit(run.pool, metric, who)]),
  );
  const exclude = excludedMetrics({
    openGoalMetrics: run.context.openGoals.get(item.traineeId) ?? [],
    rejected: run.context.rejected.get(item.traineeId) ?? [],
    today: run.today,
  });
  const gaps = findGaps({ values: row.values, group: run.groups.get(group.id) ?? NO_GROUP, fits, exclude });
  const doneIds = run.context.done.get(item.traineeId) ?? NONE_DONE;
  const candidates = proposalCandidates({
    gaps,
    history: run.history.get(group.id) ?? NO_HISTORY,
    drills: (metric) =>
      drillCandidatesFor(run.pool, { metrics: [metric], ...who, doneIds, limit: OFFERED_DRILLS_PER_GOAL }),
  });
  return { ageGroup: group.label, position: profile.position, candidates };
}

function logDropped(assessmentId: string, dropped: readonly string[]): void {
  if (dropped.length > 0) console.info(`${LOG} assessment ${assessmentId}: picks dropped: ${dropped.join(", ")}`);
}

/** A claimed Assessment: finished without a request, or asked once and finished or left for a retry. */
async function proposeClaimed(db: Db, run: RunData, item: DueItem): Promise<Outcome> {
  const { ageGroup, position, candidates } = candidatesOf(run, item);
  const before = stepBeforeModel({
    savedProposals: await savedProposalCount(db, item.id),
    candidates: candidates.length,
  });
  if (before.kind === "finish") {
    await finishCheck(db, item.id, { outcome: before.outcome });
    return before.outcome === "proposed" ? "resumed" : "noCandidates";
  }

  const outcome = await writeProposal(run.client, proposalInput({ ageGroup, position }, candidates), run.model);
  const after = stepAfterModel(outcome, candidates, run.context.sensitive.get(item.traineeId) ?? []);
  if (after.kind === "retry") {
    console.warn(`${LOG} assessment ${item.id}: no answer (${after.reason}); the check stays unfinished`);
    return "failed";
  }
  // stepAfterModel retries every outcome that is not ok; this only narrows the type.
  if (!outcome.ok) return "failed";
  logDropped(item.id, after.dropped);
  const request = { model: outcome.model, promptVersion: GOAL_PROMPT_VERSION, usage: outcome.usage };

  if (after.kind === "finish") {
    await finishCheck(db, item.id, { outcome: after.outcome, ...request });
    return "nonePicked";
  }
  const saved = await saveProposals(db, {
    assessmentId: item.id,
    traineeId: item.traineeId,
    branchIds: run.branchesOf.get(item.traineeId) ?? [],
    picks: after.picks,
    model: outcome.model,
    promptVersion: GOAL_PROMPT_VERSION,
  });
  if (saved < after.picks.length) {
    console.warn(`${LOG} assessment ${item.id}: ${saved} of ${after.picks.length} proposals saved`);
  }
  await finishCheck(db, item.id, { outcome: "proposed", ...request });
  return "proposed";
}

/** One Assessment, claimed and handled. Never throws: a failure is logged and counted. */
async function proposeOne(db: Db, run: RunData, item: DueItem): Promise<Outcome> {
  try {
    if (!(await claimCheck(db, item, run.readAt))) return "claimedElsewhere";
    return await proposeClaimed(db, run, item);
  } catch (error) {
    console.error(`${LOG} assessment ${item.id} failed:`, error instanceof Error ? error.message : String(error));
    return "failed";
  }
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

/** Trainee id to its Weekly report branch ids, for every Trainee a branch that is on takes. */
async function loadReportAudience(
  db: Db,
  settings: readonly ReportSetting[],
  onBranchIds: readonly string[],
): Promise<Map<string, string[]>> {
  const candidates = await loadAudienceCandidates(db, onBranchIds);
  return new Map(
    candidates.flatMap((candidate) => {
      const branchIds = reportBranches(candidate, settings);
      return branchIds.length === 0 ? [] : [[candidate.profileId, branchIds] as const];
    }),
  );
}

/** The history, the book and the due Trainees' context, read once; the group bars and history computed once. */
async function loadRunData(
  db: Db,
  client: Anthropic,
  today: string,
  readAt: string,
  branchesOf: ReadonlyMap<string, readonly string[]>,
  due: readonly DueItem[],
): Promise<RunData> {
  const [history, pool, context] = await Promise.all([
    loadHistory(db, today),
    loadDrillPool(db),
    loadTraineeContext(db, unique(due.map((item) => item.traineeId)), today),
  ]);
  const profiles = [...history.profiles.values()];
  return {
    client,
    model: writerModel(),
    today,
    readAt,
    branchesOf,
    profiles: history.profiles,
    rows: new Map(history.rows.map((row) => [row.id, row])),
    groups: groupMetrics(profiles, history.rows, today),
    history: historyByGroup(profiles, history.rows, today),
    pool,
    context,
  };
}

function tally(expired: number, due: number, outcomes: readonly Outcome[]): ProposeResult {
  const count = (outcome: Outcome) => outcomes.filter((o) => o === outcome).length;
  return {
    expired,
    due,
    proposed: count("proposed"),
    resumed: count("resumed"),
    noCandidates: count("noCandidates"),
    nonePicked: count("nonePicked"),
    failed: count("failed"),
    claimedElsewhere: count("claimedElsewhere"),
    notStarted: due - outcomes.length,
  };
}

/** The queue's proposals tab. The rows are already saved, so a failure is only logged. */
function refreshQueue(): void {
  try {
    revalidatePath("/admin/weekly-reports");
  } catch (error) {
    console.error(`${LOG} revalidate failed:`, error);
  }
}

/** A run that stopped early: the expiry is done, and the queue is refreshed when it changed anything. */
function skipped(reason: string, expired: number): ProposeSkipped {
  if (expired > 0) refreshQueue();
  return { skipped: reason, expired };
}

/**
 * Expires stale proposals, then proposes Goals on every due Assessment of the
 * Weekly report's Trainees, starting none after `deadline` (epoch ms).
 */
export async function proposeGoals(db: Db, today: string, deadline: number): Promise<ProposeResult | ProposeSkipped> {
  const expired = await expireStale(db, today);

  const settings = await loadReportSettings(db);
  const onBranchIds = settings.filter((setting) => setting.mode !== "off").map((setting) => setting.branchId);
  if (onBranchIds.length === 0) {
    console.info(`${LOG} no branch takes part; ${expired} stale proposals expired`);
    return skipped("no branch on", expired);
  }

  const client = anthropicClient(JOB_LIMITS);
  if (client === null) {
    console.error(`${LOG} ANTHROPIC_API_KEY is not set; no goal proposals are written`);
    return skipped("no ANTHROPIC_API_KEY", expired);
  }

  const branchesOf = await loadReportAudience(db, settings, onBranchIds);
  // Taken before any Assessment is read, so an edit saved during the run is
  // after every claim's checked_at and is looked at again.
  const readAt = new Date().toISOString();
  const due = await loadDue(db, [...branchesOf.keys()], today);
  if (due.length === 0) {
    if (expired > 0) refreshQueue();
    return tally(expired, 0, []);
  }

  const run = await loadRunData(db, client, today, readAt, branchesOf, due);
  const outcomes = await runUntil(due, CONCURRENCY, deadline, (item) => proposeOne(db, run, item));
  refreshQueue();
  const result = tally(expired, due.length, outcomes);
  console.info(`${LOG} run finished:`, JSON.stringify(result));
  return result;
}
