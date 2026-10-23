import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HistoryRow } from "@/lib/schedule/training-history";

/**
 * Roster reads for training history, through the service role: slot tables
 * are staff-only under RLS and a trainer reads rows of other trainers' Slots.
 * Callers gate access and branch scope first; this module checks nothing.
 */

const PAGE = 1000;

/** Rows a guest search may return; a typed name is rarely on more Slots than this. */
export const GUEST_ROW_LIMIT = 2000;

const HISTORY_SELECT =
  "id, trainee_name, cancelled_at, late_cancel, removed_at, " +
  "slot:daily_schedule_slots!inner(schedule_date, start_time, branch_id, location_he, called_off_at, " +
  "trainers:daily_schedule_slot_trainers(trainer_name, order_index))";

interface RawHistoryRow {
  id: string;
  trainee_name: string;
  cancelled_at: string | null;
  late_cancel: boolean;
  removed_at: string | null;
  slot: {
    schedule_date: string;
    start_time: string;
    branch_id: string | null;
    location_he: string | null;
    called_off_at: string | null;
    trainers: { trainer_name: string; order_index: number }[] | null;
  } | null;
}

function toHistoryRow(raw: RawHistoryRow): HistoryRow | null {
  if (!raw.slot) return null;
  const trainers = [...(raw.slot.trainers ?? [])].sort((a, b) => a.order_index - b.order_index);
  return {
    id: raw.id,
    trainee_name: raw.trainee_name,
    schedule_date: raw.slot.schedule_date,
    start_time: raw.slot.start_time,
    branch_id: raw.slot.branch_id,
    location_he: raw.slot.location_he,
    trainer_names: trainers.map((t) => t.trainer_name),
    cancelled_at: raw.cancelled_at,
    late_cancel: raw.late_cancel,
    removed_at: raw.removed_at,
    called_off: raw.slot.called_off_at !== null,
  };
}

/** Every roster row of one trainee, paged past PostgREST's 1000-row cap. Null on a read error. */
export async function loadTraineeHistoryRows(db: SupabaseClient, traineeId: string): Promise<HistoryRow[] | null> {
  const rows: HistoryRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = (await db
      .from("daily_schedule_slot_trainees")
      .select(HISTORY_SELECT)
      .eq("trainee_id", traineeId)
      .order("id")
      .range(from, from + PAGE - 1)) as { data: RawHistoryRow[] | null; error: { message: string } | null };
    if (error) {
      console.error("loadTraineeHistoryRows error:", error);
      return null;
    }
    for (const raw of data ?? []) {
      const row = toHistoryRow(raw);
      if (row) rows.push(row);
    }
    if ((data ?? []).length < PAGE) return rows;
  }
}

/** Escapes LIKE wildcards so a typed "%" or "_" matches itself. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Roster rows with no account whose typed name holds every word of the query,
 * in order, whatever the spacing between them. branchIds null means any
 * branch; otherwise only Slots in those branches.
 */
export async function loadGuestRows(
  db: SupabaseClient,
  query: string,
  branchIds: readonly string[] | null,
): Promise<HistoryRow[] | null> {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const pattern = `%${words.map(escapeLike).join("%")}%`;

  let request = db
    .from("daily_schedule_slot_trainees")
    .select(HISTORY_SELECT)
    .is("trainee_id", null)
    .ilike("trainee_name", pattern);
  if (branchIds !== null) {
    if (branchIds.length === 0) return [];
    request = request.in("slot.branch_id", [...branchIds]);
  }

  const { data, error } = (await request.limit(GUEST_ROW_LIMIT)) as {
    data: RawHistoryRow[] | null;
    error: { message: string } | null;
  };
  if (error) {
    console.error("loadGuestRows error:", error);
    return null;
  }
  return (data ?? []).map(toHistoryRow).filter((row): row is HistoryRow => row !== null);
}
