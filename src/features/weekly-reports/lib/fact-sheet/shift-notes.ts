/**
 * Shift report entries about one Trainee, as Fact sheet items and Holds. Pure.
 *
 * A category's shared details text may name other children, so it is copied
 * only when the category names this Trainee alone. Sensitive categories copy
 * nothing at all; they only hold the report. extractTraineeNotes() is not used
 * here because it falls back to the shared text whatever the category names.
 */

import {
  CATEGORY_COLUMNS,
  NOTE_CATEGORY_LABELS,
  parsePerTrainee,
  type NoteCategoryType,
  type PerTraineeEntries,
  type ShiftReportForNotes,
} from "@/lib/utils/trainee-notes";
import { ACHIEVEMENT_CATEGORIES, WORK_TOPICS } from "@/lib/validations/shift-report";
import { byDate, firstWord, holdDate, textOrNull } from "./format";
import { noteHandling } from "./sensitive";
import type { HoldReason, ProgressFact, WorkedOnFact } from "./types";

export type CategoryColumn = (typeof CATEGORY_COLUMNS)[number];

const PROGRESS_TYPES: readonly NoteCategoryType[] = ["achievements", "homework", "video_feedback", "praise"];

function idsOf(report: ShiftReportForNotes, column: CategoryColumn): string[] {
  const ids: unknown = report[column.traineeIdsKey];
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

function entriesOf(report: ShiftReportForNotes, column: CategoryColumn): PerTraineeEntries {
  return parsePerTrainee(report[column.perTraineeKey]) ?? {};
}

/**
 * Every Trainee the category names, by its id list or its per-trainee keys.
 * The raw keys count, even one whose entry is malformed: it still names a child.
 */
function namedIds(report: ShiftReportForNotes, column: CategoryColumn): Set<string> {
  const perTrainee: unknown = report[column.perTraineeKey];
  const keys = typeof perTrainee === "object" && perTrainee !== null && !Array.isArray(perTrainee)
    ? Object.keys(perTrainee)
    : [];
  return new Set([...idsOf(report, column), ...keys]);
}

function ownEntry(report: ShiftReportForNotes, column: CategoryColumn, traineeId: string) {
  const entries = entriesOf(report, column);
  return Object.hasOwn(entries, traineeId) ? entries[traineeId] : undefined;
}

/**
 * The Trainee's own per-trainee details when not blank; else the report-level
 * details only when the category names this Trainee alone; else null.
 */
export function traineeDetails(
  report: ShiftReportForNotes,
  column: CategoryColumn,
  traineeId: string,
): string | null {
  const own = textOrNull(ownEntry(report, column, traineeId)?.details);
  if (own !== null) return own;
  const named = namedIds(report, column);
  if (named.size !== 1 || !named.has(traineeId)) return null;
  const shared: unknown = report[column.detailsKey];
  return typeof shared === "string" ? textOrNull(shared) : null;
}

/** The entry's categories, kept only when they are known topics. */
function categoriesOf(report: ShiftReportForNotes, column: CategoryColumn, traineeId: string): string[] {
  const known: readonly string[] =
    column.type === "worked_on" ? WORK_TOPICS : column.type === "achievements" ? ACHIEVEMENT_CATEGORIES : [];
  const raw = ownEntry(report, column, traineeId)?.categories ?? [];
  return raw.filter((category) => known.includes(category));
}

function sourceOf(report: ShiftReportForNotes): string {
  const trainer = firstWord(report.trainer_name);
  return trainer ? `דוח משמרת, המאמן ${trainer}` : "דוח משמרת";
}

interface Mention {
  report: ShiftReportForNotes;
  column: CategoryColumn;
}

function mentionsOf(reports: readonly ShiftReportForNotes[], traineeId: string): Mention[] {
  const sorted = [...reports].sort((a, b) => a.report_date.localeCompare(b.report_date));
  return sorted.flatMap((report) =>
    CATEGORY_COLUMNS.filter((column) => namedIds(report, column).has(traineeId)).map((column) => ({
      report,
      column,
    })),
  );
}

function workedOnOf(m: Mention, traineeId: string): WorkedOnFact[] {
  const details = traineeDetails(m.report, m.column, traineeId);
  const items = [...categoriesOf(m.report, m.column, traineeId), ...(details ? [details] : [])];
  return items.length === 0 ? [] : [{ date: m.report.report_date, source: sourceOf(m.report), items }];
}

function progressOf(m: Mention, traineeId: string): ProgressFact {
  return {
    date: m.report.report_date,
    source: sourceOf(m.report),
    label: NOTE_CATEGORY_LABELS[m.column.type],
    details: traineeDetails(m.report, m.column, traineeId),
    categories: categoriesOf(m.report, m.column, traineeId),
  };
}

function holdOf(m: Mention): HoldReason {
  const label = NOTE_CATEGORY_LABELS[m.column.type];
  return { code: "sensitive", text: `דוח משמרת מ-${holdDate(m.report.report_date)} מציין ${label}` };
}

export function shiftReportFacts(
  reports: readonly ShiftReportForNotes[],
  traineeId: string,
): { workedOn: WorkedOnFact[]; progress: ProgressFact[]; holds: HoldReason[] } {
  const mentions = mentionsOf(reports, traineeId);
  const written = mentions.filter((m) => noteHandling(m.column.type) === "written");
  return {
    workedOn: byDate(written.filter((m) => m.column.type === "worked_on").flatMap((m) => workedOnOf(m, traineeId))),
    progress: byDate(
      written.filter((m) => PROGRESS_TYPES.includes(m.column.type)).map((m) => progressOf(m, traineeId)),
    ),
    holds: mentions.filter((m) => noteHandling(m.column.type) === "sensitive").map(holdOf),
  };
}
