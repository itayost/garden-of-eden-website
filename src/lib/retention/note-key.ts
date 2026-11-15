/**
 * Where a retention note lives. Notes, color and assigned trainer are stored
 * per (report month, phone) in retention_notes. The report tabs key a row by
 * its own phone; the ending-soon tab keys a trainee by the row the report
 * shows them on, so both places read and write the same note.
 */
import type { RetentionEntry, RetentionReportData } from "@/lib/arbox/retention";

export interface RetentionNoteKey {
  readonly reportMonth: string;
  readonly phone: string;
}

/** A report row's note key: its phone as stored, else its name. */
export function retentionNoteKey(entry: { readonly phone: string | null; readonly name: string }): string {
  return entry.phone ?? `no-phone:${entry.name.trim().toLowerCase()}`;
}

/** The report month (YYYY-MM-01) a date falls in. */
export function reportMonthOf(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export interface EndingKeyInput {
  readonly profileId: string;
  /** The last day of the trainee's Plan queue: the report month it is listed in. */
  readonly endsOn: string;
  readonly traineeName: string;
  /** profiles.phone, as the report's calendar rows carry it. */
  readonly ownPhone: string | null;
}

export interface EndingReportLink {
  readonly noteKey: RetentionNoteKey;
  /** The name and end date "העבר" copies to לקוחות שעזבו, as the report row has them. */
  readonly moveAs: { readonly name: string; readonly endDate: string };
}

const allEntries = (report: RetentionReportData) => [...report.monthly, ...report.pro, ...report.training_card];

/**
 * The row a trainee appears on in the report for the month their Plan queue
 * ends. When that month's Arbox rows list them (matched the way the view
 * matches, retentionProfileMatcher), that row, keyed by its phone, which may
 * be a parent's; otherwise the calendar row, keyed by the trainee's own phone.
 * With no stored report yet, the calendar row too (planNoteCarryOver moves a
 * note saved then once the report lists the trainee under another phone).
 */
export function endingReportLink(
  row: EndingKeyInput,
  report: RetentionReportData | null,
  matchProfile: (entry: RetentionEntry) => string | undefined,
): EndingReportLink {
  const listed = report ? allEntries(report).find((entry) => matchProfile(entry) === row.profileId) : undefined;
  return {
    noteKey: {
      reportMonth: reportMonthOf(row.endsOn),
      phone: retentionNoteKey(listed ?? { phone: row.ownPhone, name: row.traineeName }),
    },
    moveAs: listed ? { name: listed.name, endDate: listed.end_date } : { name: row.traineeName, endDate: row.endsOn },
  };
}

export interface NoteMove {
  readonly from: string;
  readonly to: string;
}

/**
 * Notes to move when a month's report is stored. The ending-soon tab may note
 * a trainee before that month has a report, under their own phone; once the
 * report lists them on an Arbox row under another phone, the note moves to
 * that row. A note moves only when no row of the report is keyed by the own
 * phone and the target has no note yet.
 */
export function planNoteCarryOver(
  report: RetentionReportData,
  ownPhoneOf: (profileId: string) => string | null,
  matchProfile: (entry: RetentionEntry) => string | undefined,
  notedPhones: ReadonlySet<string>,
): NoteMove[] {
  const entries = allEntries(report);
  const rowKeys = new Set(entries.map(retentionNoteKey));
  const taken = new Set<string>();
  return entries.flatMap((entry): NoteMove[] => {
    const profileId = matchProfile(entry);
    const from = profileId ? ownPhoneOf(profileId) : null;
    const to = retentionNoteKey(entry);
    if (from === null || from === to || rowKeys.has(from)) return [];
    if (!notedPhones.has(from) || notedPhones.has(to) || taken.has(from) || taken.has(to)) return [];
    taken.add(from);
    taken.add(to);
    return [{ from, to }];
  });
}
