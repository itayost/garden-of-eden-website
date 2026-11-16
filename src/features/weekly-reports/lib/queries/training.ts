/**
 * Who trained when, for many Trainees and one date range, through the service
 * role: counted Roster rows, Arbox entrances and Freezes. The write job reads
 * five weeks of these to decide who gets what; the Fact sheet reads the week.
 */
import "server-only";

import { fetchEntranceReport, type EntranceReportEntry } from "@/lib/arbox/reports";
import { rowCounts } from "@/lib/schedule/booking-rules";
import { readInChunks } from "@/lib/supabase/in-chunks";
import { israelDateStr } from "@/lib/utils/israel-time";
import type { FreezeSpan } from "../audience";
import { firstWord } from "../fact-sheet/format";
import type { ArboxEntrance, WeekRosterRow } from "../fact-sheet/types";
import { reportWeekEnd } from "../report-week";
import { groupBy, must, unique, type Db } from "./read";

const ROSTER_SELECT =
  "id, trainee_id, slot_id, cancelled_at, late_cancel, removed_at, slot:daily_schedule_slots!inner(schedule_date, start_time, focus_he, called_off_at, trainers:daily_schedule_slot_trainers(trainer_name, order_index))";

interface RosterRead {
  trainee_id: string | null;
  slot_id: string;
  cancelled_at: string | null;
  late_cancel: boolean;
  removed_at: string | null;
  slot: {
    schedule_date: string;
    start_time: string;
    focus_he: string | null;
    called_off_at: string | null;
    trainers: { trainer_name: string; order_index: number }[];
  };
}

function toWeekRow(raw: RosterRead): WeekRosterRow {
  const trainers = [...raw.slot.trainers].sort((a, b) => a.order_index - b.order_index);
  // A recorded removal carries a non-late cancelled_at, so rowCounts() already
  // says false; the explicit check keeps that true if the rule ever changes.
  const counts =
    raw.removed_at === null &&
    rowCounts({
      cancelled_at: raw.cancelled_at,
      late_cancel: raw.late_cancel,
      called_off: raw.slot.called_off_at !== null,
    });
  return {
    date: raw.slot.schedule_date,
    startTime: raw.slot.start_time,
    focus: raw.slot.focus_he,
    slotId: raw.slot_id,
    counts,
    lateCancel: raw.late_cancel,
    trainerFirstNames: trainers.map((t) => firstWord(t.trainer_name)).filter((name) => name !== ""),
  };
}

function byDateAndTime(a: WeekRosterRow, b: WeekRosterRow): number {
  return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
}

/**
 * Every linked Roster row of these Trainees on a Slot dated `from` to `to`,
 * by Trainee, in date and time order. Rows typed with no account are left out.
 */
export async function loadTrainingRows(
  db: Db,
  traineeIds: readonly string[],
  from: string,
  to: string,
): Promise<Map<string, WeekRosterRow[]>> {
  const rows: RosterRead[] = must(
    "daily_schedule_slot_trainees",
    await readInChunks(unique(traineeIds), "trainee_id", () =>
      db
        .from("daily_schedule_slot_trainees")
        .select(ROSTER_SELECT)
        .gte("slot.schedule_date", from)
        .lte("slot.schedule_date", to)
        .order("id"),
    ),
  );
  const linked = rows.flatMap((raw) =>
    raw.trainee_id === null ? [] : [{ traineeId: raw.trainee_id, row: toWeekRow(raw) }],
  );
  return new Map(
    [...groupBy(linked, (item) => item.traineeId)].map(([traineeId, items]) => [
      traineeId,
      items.map((item) => item.row).sort(byDateAndTime),
    ]),
  );
}

export interface ArboxDays {
  byProfile: Map<string, ArboxEntrance[]>;
  /** The Arbox read failed; "התגעגענו" is off for the run (missedYouAllowed). */
  failed: boolean;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

async function readEntrances(from: string, to: string): Promise<readonly EntranceReportEntry[] | null> {
  try {
    return await fetchEntranceReport(from, to);
  } catch (error) {
    console.error(
      "[weekly-reports] Arbox entrance report failed:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

/**
 * The Arbox entrances of these profiles from `from` to `to`, matched on the
 * Arbox user id. One read for everyone, and none when no profile is linked to
 * Arbox. A failed read (no ARBOX_API_KEY, Arbox down) is logged and reported,
 * never thrown: the run goes on without "התגעגענו".
 */
export async function loadArboxDays(
  profiles: readonly { id: string; arboxUserId: number | null }[],
  from: string,
  to: string,
): Promise<ArboxDays> {
  const linked = profiles.flatMap((p) => (p.arboxUserId === null ? [] : [{ id: p.id, arboxId: p.arboxUserId }]));
  if (linked.length === 0) return { byProfile: new Map(), failed: false };
  const entries = await readEntrances(from, to);
  if (entries === null) return { byProfile: new Map(), failed: true };

  const profilesByArboxId = groupBy(linked, (p) => String(p.arboxId));
  const matched = entries.flatMap((entry) => {
    if (entry.user_id === null || !ISO_DAY.test(entry.date)) return [];
    const date = entry.date.slice(0, 10);
    if (date < from || date > to) return [];
    const owners = profilesByArboxId.get(String(entry.user_id)) ?? [];
    return owners.map((owner) => ({ profileId: owner.id, entrance: { date, className: entry.class_name } }));
  });
  return {
    byProfile: new Map(
      [...groupBy(matched, (m) => m.profileId)].map(([profileId, items]) => [
        profileId,
        items.map((item) => item.entrance).sort((a, b) => a.date.localeCompare(b.date)),
      ]),
    ),
    failed: false,
  };
}

const FREEZE_SELECT = "id, starts_on, ends_on, ended_at, plan:trainee_plans!inner(profile_id)";

/**
 * The Freezes of these Trainees that start on or before the week's Thursday,
 * by Trainee. Whether one touches the week is freezeTouchesWeek()'s call.
 */
export async function loadFreezes(
  db: Db,
  traineeIds: readonly string[],
  weekStart: string,
): Promise<Map<string, FreezeSpan[]>> {
  const rows = must(
    "plan_freezes",
    await readInChunks(unique(traineeIds), "plan.profile_id", () =>
      db
        .from("plan_freezes")
        .select(FREEZE_SELECT)
        .lte("starts_on", reportWeekEnd(weekStart))
        .order("id"),
    ),
  );
  const spans = rows.map((row) => ({
    traineeId: row.plan.profile_id,
    span: {
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      endedOn: row.ended_at === null ? null : israelDateStr(row.ended_at),
    } satisfies FreezeSpan,
  }));
  return new Map(
    [...groupBy(spans, (s) => s.traineeId)].map(([traineeId, items]) => [traineeId, items.map((i) => i.span)]),
  );
}
