/**
 * The approval queue's reads, through the service role: one Report week's
 * rows in the caller's scope with their counts per tab, one report with its
 * Fact sheet, and the weeks the picker offers. Scope is applied here, on the
 * row's `branch_ids`, never left to RLS (the table has no policies).
 */
import "server-only";
import { readDrillsByIds } from "@/features/development-book/lib/queries/drill-pool";

import { parseGender, type Gender } from "@/lib/profile/gender";
import { byFullName, readAllPages } from "@/lib/supabase/in-chunks";
import { addDays } from "@/lib/utils/iso-date";
import type { DrillCandidate, HoldReason } from "../fact-sheet/types";
import { firstNameOf } from "../fill-name";
import { hasNewData, parentOutcome, tabCounts, tabOf, type QueueTab, type TabCounts } from "../queue-view";
import { reportWeekEnd } from "../report-week";
import { writerOutputSchema, type WriterOutput } from "../writer/output";
import { readNewDataTimes } from "./queue-new-data";
import { must, unique, type Db } from "./read";
import type { ReportKind } from "./rows";
import { inTraineeScope } from "./scope";
import { holdReasonsOf, storedSheetOf, type StoredSheet } from "./stored";
import { loadTrainingRows } from "./training";

export type { QueueTab, TabCounts } from "../queue-view";

export interface QueueRow {
  id: string;
  traineeId: string;
  fullName: string;
  branchNames: string[];
  kind: ReportKind;
  status: string;
  tab: QueueTab;
  holdReasons: HoldReason[];
  writtenAt: string | null;
  sentAt: string | null;
  /** "נשלח להורה" or why the parent got nothing; null before the row was sent. */
  parentOutcome: string | null;
  parentOpened: boolean;
  playerOpened: boolean;
  editRatio: number | null;
  /** A Shift report, Quick tag or note of the week arrived after the text was written. */
  newData: boolean;
  /** The absent list only: the last day the Trainee trained (Roster), else null. */
  lastTrainedOn: string | null;
}

export interface QueueData {
  rows: QueueRow[];
  counts: TabCounts;
}

export interface QueueQuery {
  weekStart: string;
  /** The caller's branches; null for an Admin, who sees every row. */
  scopeBranchIds: readonly string[] | null;
  /** The branch picked in the filter, already checked against the scope. */
  filterBranchId?: string;
}

const QUEUE_SELECT =
  "id, trainee_id, kind, status, branch_ids, hold_reasons, written_at, sent_at, parent_message_id, parent_skip_reason, parent_first_opened_at, player_first_opened_at, edit_ratio, trainee:profiles!weekly_reports_trainee_id_fkey(full_name)";

const KINDS: readonly ReportKind[] = ["report", "missed_you", "absent"];

function kindOf(value: string): ReportKind | null {
  return KINDS.find((kind) => kind === value) ?? null;
}

function displayName(fullName: string | null | undefined): string {
  return fullName?.trim() || "ללא שם";
}

async function readWeekRows(db: Db, query: QueueQuery) {
  return must(
    "weekly_reports",
    await readAllPages(() => {
      const base = db.from("weekly_reports").select(QUEUE_SELECT).eq("week_start", query.weekStart);
      const scoped = query.scopeBranchIds === null ? base : base.overlaps("branch_ids", [...query.scopeBranchIds]);
      const filtered = query.filterBranchId ? scoped.contains("branch_ids", [query.filterBranchId]) : scoped;
      return filtered.order("id");
    }),
  );
}

/** Branch names by id, in display order; a branch that is gone is left out. */
async function readBranchNameMap(db: Db, ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows =
    must("branches", await db.from("branches").select("id, name_he, order_index").in("id", unique(ids))) ?? [];
  return new Map([...rows].sort((a, b) => a.order_index - b.order_index).map((row) => [row.id, row.name_he]));
}

function namesOf(branchIds: readonly string[], names: ReadonlyMap<string, string>): string[] {
  return [...names].filter(([id]) => branchIds.includes(id)).map(([, name]) => name);
}

/**
 * The last day each absent Trainee trained, from the Roster of the four weeks
 * before the week. A Trainee who trained through Arbox only has none here.
 */
async function lastTrainedDays(db: Db, traineeIds: readonly string[], weekStart: string) {
  if (traineeIds.length === 0) return new Map<string, string>();
  const rows = await loadTrainingRows(db, traineeIds, addDays(weekStart, -28), addDays(weekStart, -1));
  return new Map(
    [...rows].flatMap(([id, roster]): [string, string][] => {
      const days = roster.filter((row) => row.counts).map((row) => row.date);
      return days.length > 0 ? [[id, days.reduce((a, b) => (b > a ? b : a))]] : [];
    }),
  );
}

type WeekRow = Awaited<ReturnType<typeof readWeekRows>>[number];

interface RowContext {
  names: ReadonlyMap<string, string>;
  newData: ReadonlyMap<string, readonly string[]>;
  lastTrained: ReadonlyMap<string, string>;
}

/** A row as the queue shows it, or null for a kind or status it does not know (logged). */
function toQueueRow(row: WeekRow, context: RowContext): QueueRow | null {
  const kind = kindOf(row.kind);
  const tab = tabOf(row.kind, row.status);
  if (kind === null || tab === null) {
    console.error(`[weekly-reports] report ${row.id} has an unknown kind or status: ${row.kind}/${row.status}`);
    return null;
  }
  return {
    id: row.id,
    traineeId: row.trainee_id,
    fullName: displayName(row.trainee?.full_name),
    branchNames: namesOf(row.branch_ids, context.names),
    kind,
    status: row.status,
    tab,
    holdReasons: holdReasonsOf(row.hold_reasons),
    writtenAt: row.written_at,
    sentAt: row.sent_at,
    parentOutcome: parentOutcome({
      status: row.status,
      parentMessageId: row.parent_message_id,
      parentSkipReason: row.parent_skip_reason,
    }),
    parentOpened: row.parent_first_opened_at !== null,
    playerOpened: row.player_first_opened_at !== null,
    editRatio: row.edit_ratio,
    newData: kind === "report" && hasNewData(row.written_at, context.newData.get(row.trainee_id) ?? []),
    lastTrainedOn: context.lastTrained.get(row.trainee_id) ?? null,
  };
}

/**
 * The Report week's rows the caller may see, filtered by the picked branch,
 * sorted by name, with the counts per tab. Besides the row's own branches
 * (readWeekRows), its Trainee must be in the caller's branches now
 * (inTraineeScope): the rule every action checks, so the list never shows a
 * name and its Holds that the caller could not open.
 */
export async function loadQueue(db: Db, query: QueueQuery): Promise<QueueData> {
  if (query.scopeBranchIds !== null && query.scopeBranchIds.length === 0) {
    return { rows: [], counts: tabCounts([]) };
  }
  const raw = (await inTraineeScope(db, await readWeekRows(db, query), query.scopeBranchIds)).sort((a, b) =>
    byFullName({ full_name: a.trainee?.full_name ?? null }, { full_name: b.trainee?.full_name ?? null }),
  );
  const written = raw.filter((row) => row.kind === "report" && row.written_at !== null);
  const absent = raw.filter((row) => row.kind === "absent").map((row) => row.trainee_id);
  const range = { from: query.weekStart, to: reportWeekEnd(query.weekStart) };
  const [names, newData, lastTrained] = await Promise.all([
    readBranchNameMap(db, raw.flatMap((row) => row.branch_ids)),
    readNewDataTimes(db, unique(written.map((row) => row.trainee_id)), range),
    lastTrainedDays(db, unique(absent), query.weekStart),
  ]);
  const rows = raw.flatMap((row) => {
    const shown = toQueueRow(row, { names, newData, lastTrained });
    return shown === null ? [] : [shown];
  });
  return { rows, counts: tabCounts(rows.map((row) => row.tab)) };
}

export interface ReportDetail {
  id: string;
  traineeId: string;
  weekStart: string;
  kind: ReportKind;
  status: string;
  /** The row's `branch_ids`; the page checks them against the caller's scope. */
  branchIds: string[];
  branchNames: string[];
  fullName: string;
  firstName: string;
  gender: Gender | null;
  holdReasons: HoldReason[];
  /** The Fact sheet the model saw and the body block; null for the other kinds. */
  stored: StoredSheet | null;
  playerText: string | null;
  parentText: string | null;
  /** The model's own texts, never changed by an edit; null before the text is written. */
  original: WriterOutput | null;
  drills: DrillCandidate[];
  writtenAt: string | null;
  editedAt: string | null;
  editedByName: string | null;
  editRatio: number | null;
  model: string | null;
  sentAt: string | null;
  parentOutcome: string | null;
  /** The row's `updated_at`: the actions refuse a screen older than it. */
  version: string;
}

const DETAIL_SELECT =
  "id, trainee_id, week_start, kind, status, branch_ids, hold_reasons, fact_sheet, original_output, player_text, parent_text, drill_ids, written_at, edited_at, edit_ratio, model, sent_at, parent_message_id, parent_skip_reason, updated_at, trainee:profiles!weekly_reports_trainee_id_fkey(full_name, gender), editor:profiles!weekly_reports_edited_by_fkey(full_name)";

/** One report with everything its sheet shows, or null when there is no such row. */
export async function loadReportDetail(db: Db, id: string): Promise<ReportDetail | null> {
  const row = must("weekly_reports", await db.from("weekly_reports").select(DETAIL_SELECT).eq("id", id).maybeSingle());
  if (row === null) return null;
  const kind = kindOf(row.kind);
  if (kind === null) return null;
  const original = writerOutputSchema.safeParse(row.original_output);
  // The chosen drills in the order chosen, with the book's name and "למה" line.
  const [names, drills] = await Promise.all([
    readBranchNameMap(db, row.branch_ids),
    readDrillsByIds(db, row.drill_ids),
  ]);
  return {
    id: row.id,
    traineeId: row.trainee_id,
    weekStart: row.week_start,
    kind,
    status: row.status,
    branchIds: [...row.branch_ids],
    branchNames: namesOf(row.branch_ids, names),
    fullName: displayName(row.trainee?.full_name),
    firstName: firstNameOf(row.trainee?.full_name ?? null),
    gender: parseGender(row.trainee?.gender),
    holdReasons: holdReasonsOf(row.hold_reasons),
    stored: storedSheetOf(row.fact_sheet),
    playerText: row.player_text,
    parentText: row.parent_text,
    original: original.success ? original.data : null,
    drills,
    writtenAt: row.written_at,
    editedAt: row.edited_at,
    editedByName: row.editor?.full_name?.trim() || null,
    editRatio: row.edit_ratio,
    model: row.model,
    sentAt: row.sent_at,
    parentOutcome: parentOutcome({
      status: row.status,
      parentMessageId: row.parent_message_id,
      parentSkipReason: row.parent_skip_reason,
    }),
    version: row.updated_at,
  };
}

/**
 * The Report weeks the picker offers, newest first: every week the write job
 * started a run for. The job makes a week's rows before it records the run,
 * and the run table holds one small row a week, where the report table holds
 * a hundred or more.
 */
export async function queueWeeks(db: Db): Promise<string[]> {
  const rows = must(
    "weekly_report_runs",
    await db.from("weekly_report_runs").select("week_start").order("week_start", { ascending: false }),
  );
  return (rows ?? []).map((row) => row.week_start);
}
