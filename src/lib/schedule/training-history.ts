import { minutesUntilSlot, rowCounts, type IsraelNow } from "@/lib/schedule/booking-rules";

/**
 * A trainee's trainings as the calendar recorded them: one roster row per
 * Slot, read for the user page and for names typed into a roster with no
 * account. What counts as a used session is rowCounts(), the rule the plan
 * queue charges by.
 */

/** One roster row joined to its Slot, in the shape the loader builds. */
export interface HistoryRow {
  id: string;
  trainee_name: string;
  schedule_date: string;
  /** HH:MM or HH:MM:SS. */
  start_time: string;
  branch_id: string | null;
  location_he: string | null;
  trainer_names: readonly string[];
  cancelled_at: string | null;
  late_cancel: boolean;
  removed_at: string | null;
  called_off: boolean;
}

export type HistoryStatus = "attended" | "late_cancel" | "cancelled" | "removed" | "called_off" | "upcoming";

export interface HistoryEntry extends HistoryRow {
  status: HistoryStatus;
}

export function historyStatus(row: HistoryRow, now: IsraelNow): HistoryStatus {
  if (row.called_off) return "called_off";
  if (row.removed_at) return "removed";
  if (row.cancelled_at) return row.late_cancel ? "late_cancel" : "cancelled";
  return minutesUntilSlot(row.schedule_date, row.start_time, now) > 0 ? "upcoming" : "attended";
}

const newestFirst = (a: HistoryRow, b: HistoryRow) =>
  b.schedule_date.localeCompare(a.schedule_date) || b.start_time.localeCompare(a.start_time);

export function toHistoryEntries(rows: readonly HistoryRow[], now: IsraelNow): HistoryEntry[] {
  return [...rows].sort(newestFirst).map((row) => ({ ...row, status: historyStatus(row, now) }));
}

export interface HistorySummary {
  attended: number;
  lateCancel: number;
  cancelled: number;
  removed: number;
  calledOff: number;
  upcoming: number;
  /** Sessions used: attended plus late cancels, as the plan queue counts them. */
  used: number;
  /** The last training that took place (attended), or null. */
  lastTrainingDate: string | null;
}

export function historySummary(entries: readonly HistoryEntry[]): HistorySummary {
  const count = (status: HistoryStatus) => entries.filter((e) => e.status === status).length;
  const attended = entries.filter((e) => e.status === "attended");
  const lastTrainingDate = attended.reduce<string | null>(
    (latest, e) => (latest === null || e.schedule_date > latest ? e.schedule_date : latest),
    null,
  );
  return {
    attended: attended.length,
    lateCancel: count("late_cancel"),
    cancelled: count("cancelled"),
    removed: count("removed"),
    calledOff: count("called_off"),
    upcoming: count("upcoming"),
    used: entries.filter((e) => e.status !== "upcoming" && rowCounts(e)).length,
    lastTrainingDate,
  };
}

/** Shortest query the guest search runs: one letter matches half the roster. */
export const GUEST_SEARCH_MIN_LENGTH = 2;

/** A typed name collapsed for display: trimmed, single spaces. */
export function cleanGuestName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** The key that treats two spellings of one typed name as the same person. */
export function guestNameKey(name: string): string {
  return cleanGuestName(name).toLowerCase();
}

export interface GuestGroup {
  key: string;
  /** The spelling on the newest roster row. */
  name: string;
  used: number;
  upcoming: number;
  lastTrainingDate: string | null;
  /** Branches of the Slots the name was on, in first-seen order (newest first). */
  branchIds: string[];
  entries: HistoryEntry[];
}

/** Roster rows with no account, grouped by typed name, most used first. */
export function groupGuestRows(rows: readonly HistoryRow[], now: IsraelNow): GuestGroup[] {
  const byKey = new Map<string, HistoryEntry[]>();
  for (const entry of toHistoryEntries(rows, now)) {
    const key = guestNameKey(entry.trainee_name);
    byKey.set(key, [...(byKey.get(key) ?? []), entry]);
  }

  const groups = [...byKey.entries()].map(([key, entries]): GuestGroup => {
    const summary = historySummary(entries);
    const branchIds = [...new Set(entries.map((e) => e.branch_id).filter((id): id is string => id !== null))];
    return {
      key,
      name: cleanGuestName(entries[0].trainee_name),
      used: summary.used,
      upcoming: summary.upcoming,
      lastTrainingDate: summary.lastTrainingDate,
      branchIds,
      entries,
    };
  });

  return groups.sort((a, b) => b.used - a.used || a.name.localeCompare(b.name, "he"));
}
