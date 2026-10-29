/**
 * Survey results as CSV rows: one row per Response with Hebrew headers. Pure;
 * the export button joins the rows with Papa.unparse and adds the BOM.
 */
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

function cellText(cell: CellAnswer | undefined): string {
  if (cell === undefined) return "";
  if (cell.rating !== null) return String(cell.rating);
  if (cell.text !== null) return cell.text;
  return cell.optionLabels.join(", ");
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
    "שם": row.fullName,
    "סניף": row.branchNames.join(", "),
    "שנתון": row.birthYear === null ? "" : String(row.birthYear),
    "נשלח": formatSentAt(row.submittedAt),
    ...Object.fromEntries(
      questions.map((q, i) => [`${i + 1}. ${q.text}`, cellText(row.answers[q.id])]),
    ),
  }));
}
