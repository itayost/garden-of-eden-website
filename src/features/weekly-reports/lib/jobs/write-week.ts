/**
 * The write job: at 01:00 on Friday startWeek() makes the Report week's rows
 * and sends one Message Batches request for the reports; from 07:30
 * finishWeek() collects the batch and writes whatever is still missing with
 * direct requests, until every report has a text or the morning is over.
 *
 * Every write here is conditional (rows.ts), so a rerun, an overlapping run or
 * a late batch answer never undoes later work. The run row is claimed before
 * the batch goes out, so two starts never pay for two batches.
 */
import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { revalidateWeeklyReports } from "../cache-tags";
import type { FactSheet } from "../fact-sheet/types";
import type { Db } from "../queries/read";
import {
  closeEarlierWeeks,
  loadRowsToWrite,
  saveWriterFailure,
  saveWriterResult,
  upsertWeekRows,
} from "../queries/rows";
import { loadReportSettings } from "../queries/settings";
import { lastCompletedWeekStart } from "../report-week";
import { cancelBatch, collectBatch, submitBatch } from "../writer/batch";
import { anthropicClient } from "../writer/client";
import { writeDirect } from "../writer/direct";
import type { WriteOutcome } from "../writer/output";
import { writerModel, type WriterModel } from "../writer/request";
import { PROMPT_VERSION } from "../writer/style-guide";
import { runUntil } from "./run-until";
import { buildSheets, planWeek } from "./week-plan";
import { countRows, weekRows, type RowCounts } from "./week-rows";

const LOG = "[weekly-reports-write]";

/** Direct requests in flight at once. */
const DIRECT_CONCURRENCY = 4;
/** Batch results saved at once: two small database calls each. */
const SAVE_CONCURRENCY = 8;

const NO_KEY = "no ANTHROPIC_API_KEY";

export interface Skipped {
  skipped: string;
  weekStart?: string;
}

export interface StartResult extends RowCounts {
  weekStart: string;
  /** Rows of earlier weeks that never went out, now not_sent. */
  closedEarlier: number;
  /** The Arbox read failed, so nobody got "התגעגענו" this run. */
  arboxFailed: boolean;
  /** Reports sent to be written. */
  toWrite: number;
  batchId: string | null;
  /** The batch could not be sent; the direct pass writes everything from 07:30. */
  batchFailed: boolean;
}

export interface FinishResult {
  weekStart: string;
  /** No run existed, so this call made the week's rows first (and sent no batch). */
  started: boolean;
  batch: BatchSummary;
  direct: DirectSummary;
  /** Reports still without a text: the next finish run writes them. */
  leftToWrite: number;
  finished: boolean;
}

type BatchState = "none" | "already collected" | "collected" | "partly saved" | "running, canceled" | "unreachable";

interface BatchSummary {
  state: BatchState;
  saved: number;
  /** Results that were already written, closed or changed meanwhile. */
  unchanged: number;
  /** Results with no usable text, left to the direct pass. */
  failed: number;
}

interface DirectSummary {
  written: number;
  unchanged: number;
  failed: number;
  /** Not started before the deadline. */
  notStarted: number;
}

interface RunRow {
  batch_id: string | null;
  batch_collected_at: string | null;
  finished_at: string | null;
  prompt_version: string;
}

// ---------------------------------------------------------------------------
// Shared steps
// ---------------------------------------------------------------------------

function runFailure(what: string, message: string): Error {
  console.error(`${LOG} weekly_report_runs ${what} failed:`, message);
  return new Error(`Weekly reports: weekly_report_runs ${what} failed`);
}

async function readRun(db: Db, weekStart: string): Promise<RunRow | null> {
  const { data, error } = await db
    .from("weekly_report_runs")
    .select("batch_id, batch_collected_at, finished_at, prompt_version")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw runFailure("read", error.message);
  return data;
}

/** No ANTHROPIC_API_KEY, no reports: the job logs and stops. */
function noKey(): Skipped {
  console.error(`${LOG} ANTHROPIC_API_KEY is not set; no weekly reports are written`);
  return { skipped: NO_KEY };
}

/** The queue and its badge. The rows are already saved, so a failure is only logged. */
function refreshQueue(): void {
  try {
    revalidateWeeklyReports();
  } catch (error) {
    console.error(`${LOG} revalidate failed:`, error);
  }
}

// ---------------------------------------------------------------------------
// Start: the rows and the batch
// ---------------------------------------------------------------------------

/**
 * Takes the week's run with one insert on its primary key. False when another
 * run took it first. With nothing to write the run is finished at once.
 */
async function claimRun(db: Db, weekStart: string, model: WriterModel, nothingToWrite: boolean): Promise<boolean> {
  const { error } = await db.from("weekly_report_runs").insert({
    week_start: weekStart,
    model,
    prompt_version: PROMPT_VERSION,
    batch_id: null,
    finished_at: nothingToWrite ? new Date().toISOString() : null,
  });
  if (error?.code === "23505") return false;
  if (error) throw runFailure("insert", error.message);
  return true;
}

/**
 * Sends the batch and records its id on the run. Null when it could not be
 * sent or recorded: the direct pass then writes every report.
 */
async function sendBatch(
  db: Db,
  client: Anthropic,
  weekStart: string,
  items: readonly { id: string; sheet: FactSheet }[],
  model: WriterModel,
): Promise<string | null> {
  let batchId: string;
  try {
    batchId = await submitBatch(client, items, model);
  } catch {
    // submitBatch logged the status and type; the rows wait for the direct pass.
    return null;
  }
  const { error } = await db.from("weekly_report_runs").update({ batch_id: batchId }).eq("week_start", weekStart);
  if (error) {
    console.error(`${LOG} batch ${batchId} not recorded, canceling it:`, error.message);
    await cancelBatch(client, batchId);
    return null;
  }
  return batchId;
}

/**
 * Makes the current Report week's rows and sends the reports to be written.
 * Stops first when there is no ANTHROPIC_API_KEY, when the week was already
 * started, or when no branch takes part. `batch: false` (a start made late by
 * finishWeek) makes the rows and the run without a batch, for the direct
 * pass to write.
 */
export async function startWeek(db: Db, today: string, options: { batch?: boolean } = {}): Promise<StartResult | Skipped> {
  const client = anthropicClient();
  if (client === null) return noKey();
  const weekStart = lastCompletedWeekStart(today);
  if ((await readRun(db, weekStart)) !== null) return { skipped: "already started", weekStart };

  const closedEarlier = await closeEarlierWeeks(db, weekStart);
  const settings = await loadReportSettings(db);
  if (!settings.some((setting) => setting.mode !== "off")) {
    console.info(`${LOG} no branch takes part; ${closedEarlier} earlier rows closed`);
    return { skipped: "no branch on", weekStart };
  }

  const plan = await planWeek(db, weekStart, settings);
  const reports = plan.trainees.filter((trainee) => trainee.kind === "report");
  const sheets = await buildSheets(db, plan, reports, today);
  const rows = weekRows(weekStart, plan.trainees, sheets);
  await upsertWeekRows(db, rows);

  const toWrite = await loadRowsToWrite(db, weekStart);
  const model = writerModel();
  if (!(await claimRun(db, weekStart, model, toWrite.length === 0))) {
    return { skipped: "already started", weekStart };
  }
  const sendsBatch = options.batch !== false && toWrite.length > 0;
  const batchId = sendsBatch ? await sendBatch(db, client, weekStart, toWrite, model) : null;
  refreshQueue();

  return {
    weekStart,
    closedEarlier,
    arboxFailed: plan.arboxFailed,
    ...countRows(rows),
    toWrite: toWrite.length,
    batchId,
    batchFailed: sendsBatch && batchId === null,
  };
}

// ---------------------------------------------------------------------------
// Finish: collect the batch, write the rest directly
// ---------------------------------------------------------------------------

type SaveResult = "saved" | "unchanged" | "failed";

/** One batch outcome saved; a failed one is left to the direct pass. Never throws. */
async function saveBatchOutcome(db: Db, id: string, outcome: WriteOutcome, promptVersion: string): Promise<SaveResult> {
  if (!outcome.ok) {
    console.warn(`${LOG} batch did not write report ${id}: ${outcome.reason}`);
    return "failed";
  }
  try {
    const written = { output: outcome.output, usage: outcome.usage, model: outcome.model };
    return (await saveWriterResult(db, id, written, promptVersion)) ? "saved" : "unchanged";
  } catch {
    // rows.ts logged it; the row is still unwritten, so the direct pass writes it.
    return "failed";
  }
}

function batchSummary(state: BatchState, results: readonly SaveResult[] = []): BatchSummary {
  return {
    state,
    saved: results.filter((r) => r === "saved").length,
    unchanged: results.filter((r) => r === "unchanged").length,
    failed: results.filter((r) => r === "failed").length,
  };
}

/**
 * Collects the run's batch once it has ended and saves what it wrote, under
 * the prompt version it was sent with. A batch still running is canceled so
 * it bills no more; the next run collects what it finished.
 */
async function collectRun(db: Db, client: Anthropic, weekStart: string, run: RunRow, deadline: number): Promise<BatchSummary> {
  if (run.batch_id === null) return batchSummary("none");
  if (run.batch_collected_at !== null) return batchSummary("already collected");

  let collected: Awaited<ReturnType<typeof collectBatch>>;
  try {
    collected = await collectBatch(client, run.batch_id);
  } catch {
    // collectBatch logged the status and type; the direct pass goes on, the next run tries again.
    return batchSummary("unreachable");
  }
  if (!collected.ended) {
    await cancelBatch(client, run.batch_id);
    return batchSummary("running, canceled");
  }

  const outcomes = [...collected.results];
  const results = await runUntil(outcomes, SAVE_CONCURRENCY, deadline, ([id, outcome]) =>
    saveBatchOutcome(db, id, outcome, run.prompt_version),
  );
  if (results.length < outcomes.length) return batchSummary("partly saved", results);

  const { error } = await db
    .from("weekly_report_runs")
    .update({ batch_collected_at: new Date().toISOString() })
    .eq("week_start", weekStart);
  if (error) throw runFailure("update", error.message);
  return batchSummary("collected", results);
}

type DirectResult = "written" | "unchanged" | "failed";

/** One report written and saved, or marked "הכתיבה נכשלה" for a later pass. Never throws. */
async function writeOne(
  db: Db,
  client: Anthropic,
  id: string,
  sheet: FactSheet,
  model: WriterModel,
): Promise<DirectResult> {
  try {
    const outcome = await writeDirect(client, sheet, model);
    if (outcome.ok) {
      const written = { output: outcome.output, usage: outcome.usage, model: outcome.model };
      return (await saveWriterResult(db, id, written, PROMPT_VERSION)) ? "written" : "unchanged";
    }
    console.warn(`${LOG} direct write of report ${id} failed: ${outcome.reason}`);
    await saveWriterFailure(db, id);
    return "failed";
  } catch {
    // rows.ts logged the database error; the row stays unwritten for the next run.
    return "failed";
  }
}

/** Writes every report of the week still without a text, starting none after `deadline`. */
async function writeMissing(db: Db, client: Anthropic, weekStart: string, deadline: number): Promise<DirectSummary> {
  const rows = await loadRowsToWrite(db, weekStart);
  const model = writerModel();
  const results = await runUntil(rows, DIRECT_CONCURRENCY, deadline, ({ id, sheet }) =>
    writeOne(db, client, id, sheet, model),
  );
  return {
    written: results.filter((r) => r === "written").length,
    unchanged: results.filter((r) => r === "unchanged").length,
    failed: results.filter((r) => r === "failed").length,
    notStarted: rows.length - results.length,
  };
}

async function markFinished(db: Db, weekStart: string): Promise<void> {
  const { error } = await db
    .from("weekly_report_runs")
    .update({ finished_at: new Date().toISOString() })
    .eq("week_start", weekStart)
    .is("finished_at", null);
  if (error) throw runFailure("update", error.message);
}

/** The week's run; when there is none yet (the 01:00 start never ran), the week is started now without a batch. */
async function runOrStart(db: Db, today: string, weekStart: string): Promise<{ run: RunRow | null; started: StartResult | Skipped | null }> {
  const run = await readRun(db, weekStart);
  if (run !== null) return { run, started: null };
  const started = await startWeek(db, today, { batch: false });
  return { run: await readRun(db, weekStart), started };
}

/**
 * Friday 07:30 to 11:59, every half hour: collects the batch, then writes
 * whatever is still missing with direct requests, starting none after
 * `deadline` (epoch ms). The week is finished once every report has a text;
 * a report the writer failed on keeps "הכתיבה נכשלה" until a later run writes it.
 */
export async function finishWeek(db: Db, today: string, deadline: number): Promise<FinishResult | Skipped> {
  const client = anthropicClient();
  if (client === null) return noKey();
  const weekStart = lastCompletedWeekStart(today);
  const { run, started } = await runOrStart(db, today, weekStart);
  if (run === null) {
    return { skipped: started && "skipped" in started ? started.skipped : "not started", weekStart };
  }
  if (run.finished_at !== null) {
    return { skipped: started === null ? "already finished" : "started, nothing to write", weekStart };
  }

  const batch = await collectRun(db, client, weekStart, run, deadline);
  const direct = await writeMissing(db, client, weekStart, deadline);
  const leftToWrite = (await loadRowsToWrite(db, weekStart)).length;
  if (leftToWrite === 0) await markFinished(db, weekStart);
  refreshQueue();

  return { weekStart, started: started !== null, batch, direct, leftToWrite, finished: leftToWrite === 0 };
}
