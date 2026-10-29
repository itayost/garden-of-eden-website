/**
 * Survey results as CSV rows: one row per Response with Hebrew headers, and the
 * text of the download. Pure. Every text cell built from data is already safe
 * to open in Excel (see neutralise), so the text is written without Papa's own
 * formula escaping, which would quote those cells a second time.
 */
import Papa from "papaparse";

import type { GridRow, CellAnswer } from "./report";
import type { SurveyQuestion } from "./types";

const ISRAEL_TIME_ZONE = "Asia/Jerusalem";

const SENT_AT_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: ISRAEL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "28.10.2026 17:42": the moment in Israel time, day first. */
export function formatSentAt(iso: string): string {
  const parts = Object.fromEntries(
    SENT_AT_FORMAT.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

/** A cell that starts with one of these is read by Excel as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Trainees type the free text and staff open the export in Excel, so a cell
 * that could run as a formula gets a leading quote. Only the first character
 * matters, which also covers multi-line text ("=1+1\nline 2").
 */
function neutralise(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

function cellText(cell: CellAnswer | undefined): string {
  if (cell === undefined) return "";
  if (cell.rating !== null) return String(cell.rating);
  if (cell.text !== null) return neutralise(cell.text);
  return neutralise(cell.optionLabels.join(", "));
}

/**
 * The columns are name, branch, birth year, sent at, then "<n>. <Question>" in
 * order (the number keeps two Questions with the same text apart). A skipped
 * Question is an empty cell. Rows keep the order they are given.
 */
export function surveyCsvRows(
  questions: readonly SurveyQuestion[],
  rows: readonly GridRow[],
): Record<string, string>[] {
  return rows.map((row) => ({
    "שם": neutralise(row.fullName),
    "סניף": neutralise(row.branchNames.join(", ")),
    "שנתון": row.birthYear === null ? "" : String(row.birthYear),
    "נשלח": formatSentAt(row.submittedAt),
    ...Object.fromEntries(
      questions.map((q, i) => [`${i + 1}. ${q.text}`, cellText(row.answers[q.id])]),
    ),
  }));
}

/** The file's text: the rows as CSV behind a byte order mark, so Excel reads the Hebrew. */
export function csvDownloadText(rows: readonly Record<string, string>[]): string {
  return `\uFEFF${Papa.unparse([...rows])}`;
}
