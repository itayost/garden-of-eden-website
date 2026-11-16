/**
 * The weekly_reports rows the jobs make and fill, through the service role.
 *
 * Every write is conditional so a rerun or a late answer never undoes later
 * work: new rows never overwrite existing ones, and a text is saved only into
 * a row that has none yet, in a status that still takes one, and unchanged
 * since it was read (so a Hold a person added meanwhile is never lost).
 */
import "server-only";

import { chunk, readAllPages } from "@/lib/supabase/in-chunks";
import type { TablesUpdate } from "@/types/database";
import type { FactSheet, HoldReason } from "../fact-sheet/types";
import { replaceTextProblems, reportProblems } from "../guardrails";
import type { WriterOutput } from "../writer/output";
import { must, type Db } from "./read";
import { holdReasonsOf, offeredDrillIds, storedSheetOf, toJson, type StoredSheet } from "./stored";

export type { StoredSheet } from "./stored";

export type ReportKind = "report" | "missed_you" | "absent";

/** A new row's status: a report waits or is held, "התגעגענו" goes approved, the absent list is listed. */
export type NewRowStatus = "pending" | "held" | "approved" | "listed";

export interface NewReportRow {
  traineeId: string;
  weekStart: string;
  kind: ReportKind;
  status: NewRowStatus;
  /** The Trainee's report branches; staff scope filters on them. */
  branchIds: string[];
  holdReasons: HoldReason[];
  /** The built sheet and body of a report row; null for the other kinds. */
  factSheet: StoredSheet | null;
  /** Approved by the system, not a person ("התגעגענו"); approved_at is stamped with it. */
  approvedAutomatically: boolean;
}

/** What the writer returned for one row. */
export interface WrittenReport {
  output: WriterOutput;
  usage: unknown;
  /** The model that wrote it, as the answer names it (a fallback model when one ran). */
  model: string;
}

const WRITING_FAILED: HoldReason = { code: "writing_failed", text: "הכתיבה נכשלה" };

/** The statuses a row still takes a text in. */
const WRITABLE: readonly NewRowStatus[] = ["pending", "held"];

/** The statuses closed when a new Report week starts. */
const OPEN: readonly NewRowStatus[] = ["pending", "held", "approved"];

const INSERT_CHUNK = 200;

function writeError(what: string, message: string): Error {
  console.error(`[weekly-reports] weekly_reports ${what} failed:`, message);
  return new Error(`Weekly reports: weekly_reports ${what} failed`);
}

function toInsert(row: NewReportRow, now: string) {
  return {
    trainee_id: row.traineeId,
    week_start: row.weekStart,
    kind: row.kind,
    status: row.status,
    branch_ids: [...row.branchIds],
    hold_reasons: toJson(row.holdReasons),
    fact_sheet: row.factSheet === null ? null : toJson(row.factSheet),
    approved_automatically: row.approvedAutomatically,
    approved_at: row.approvedAutomatically ? now : null,
  };
}

/**
 * Inserts the week's rows; a Trainee who already has a row for the week keeps
 * it as it is, so a rerun never overwrites a written or approved report.
 */
export async function upsertWeekRows(db: Db, rows: readonly NewReportRow[]): Promise<void> {
  const now = new Date().toISOString();
  for (const slice of chunk(rows, INSERT_CHUNK)) {
    const { error } = await db
      .from("weekly_reports")
      .upsert(
        slice.map((row) => toInsert(row, now)),
        { onConflict: "trainee_id,week_start", ignoreDuplicates: true },
      );
    if (error) throw writeError("insert", error.message);
  }
}

/** Rows of earlier weeks that never went out become not_sent. Returns how many. */
export async function closeEarlierWeeks(db: Db, weekStart: string): Promise<number> {
  const { data, error } = await db
    .from("weekly_reports")
    .update({ status: "not_sent" })
    .lt("week_start", weekStart)
    .in("status", OPEN)
    .select("id");
  if (error) throw writeError("close", error.message);
  return data?.length ?? 0;
}

/**
 * The week's report rows still waiting for a text: pending or held, with no
 * missing gender (the model cannot write the right forms without it). A row
 * whose stored sheet cannot be read is logged and left out.
 */
export async function loadRowsToWrite(db: Db, weekStart: string): Promise<{ id: string; sheet: FactSheet }[]> {
  const rows = must(
    "weekly_reports",
    await readAllPages(() =>
      db
        .from("weekly_reports")
        .select("id, fact_sheet, hold_reasons")
        .eq("week_start", weekStart)
        .eq("kind", "report")
        .is("written_at", null)
        .in("status", WRITABLE)
        .order("id"),
    ),
  );
  return rows.flatMap((row) => {
    if (holdReasonsOf(row.hold_reasons).some((reason) => reason.code === "missing_gender")) return [];
    const stored = storedSheetOf(row.fact_sheet);
    if (stored === null) {
      console.error(`[weekly-reports] report ${row.id} has no readable Fact sheet; not written`);
      return [];
    }
    return [{ id: row.id, sheet: stored.sheet }];
  });
}

interface UnwrittenRow {
  factSheet: StoredSheet | null;
  holdReasons: HoldReason[];
  updatedAt: string;
}

/** The row when it still takes a text, else null. */
async function readUnwritten(db: Db, id: string): Promise<UnwrittenRow | null> {
  const row = must(
    "weekly_reports",
    await db
      .from("weekly_reports")
      .select("fact_sheet, hold_reasons, updated_at")
      .eq("id", id)
      .is("written_at", null)
      .in("status", WRITABLE)
      .maybeSingle(),
  );
  if (row === null) return null;
  return {
    factSheet: storedSheetOf(row.fact_sheet),
    holdReasons: holdReasonsOf(row.hold_reasons),
    updatedAt: row.updated_at,
  };
}

/** One conditional update: only an unwritten, writable row unchanged since `updatedAt`. */
async function updateUnwritten(db: Db, id: string, updatedAt: string, values: TablesUpdate<"weekly_reports">): Promise<boolean> {
  const { data, error } = await db
    .from("weekly_reports")
    .update(values)
    .eq("id", id)
    .is("written_at", null)
    .in("status", WRITABLE)
    .eq("updated_at", updatedAt)
    .select("id");
  if (error) throw writeError("update", error.message);
  return (data?.length ?? 0) > 0;
}

/**
 * Saves the writer's texts into a row that has none yet, after the
 * guardrails: their problems replace the row's old text problems, the
 * sensitive and manual Holds stay, and the row is held while any reason
 * remains. Drill ids outside the sheet's candidates are a Hold, not a value
 * to store. False when the row was written, closed or changed meanwhile.
 */
export async function saveWriterResult(
  db: Db,
  id: string,
  written: WrittenReport,
  promptVersion: string,
): Promise<boolean> {
  const row = await readUnwritten(db, id);
  if (row === null) return false;
  if (row.factSheet === null) {
    console.error(`[weekly-reports] report ${id} has no readable Fact sheet; text not saved`);
    return false;
  }
  const { sheet } = row.factSheet;
  const holds = replaceTextProblems(row.holdReasons, reportProblems(sheet, written.output));
  return updateUnwritten(db, id, row.updatedAt, {
    player_text: written.output.player_text,
    parent_text: written.output.parent_text,
    drill_ids: offeredDrillIds(sheet, written.output.drill_ids),
    original_output: toJson(written.output),
    model: written.model,
    prompt_version: promptVersion,
    usage: toJson(written.usage),
    written_at: new Date().toISOString(),
    hold_reasons: toJson(holds),
    status: holds.length > 0 ? "held" : "pending",
  });
}

/**
 * Marks a row the writer could not write: held with "הכתיבה נכשלה" (once).
 * The row stays unwritten, so a later pass may still write it.
 */
export async function saveWriterFailure(db: Db, id: string): Promise<boolean> {
  const row = await readUnwritten(db, id);
  if (row === null) return false;
  const holds = [...row.holdReasons.filter((reason) => reason.code !== WRITING_FAILED.code), WRITING_FAILED];
  return updateUnwritten(db, id, row.updatedAt, { hold_reasons: toJson(holds), status: "held" });
}
