import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import { loadBranchIdsByProfile } from "@/features/branches/lib/memberships";
import type { RosterRowLite } from "@/lib/schedule/booking-rules";
import { bookableBranchIds } from "./materialize";

/** The first of the trainee's branches that has a bookable band, or null. */
export async function loadBookableBranchForUser(db: SupabaseClient, userId: string): Promise<string | null> {
  const [memberships, bookable] = await Promise.all([
    loadBranchIdsByProfile(db, [userId]),
    bookableBranchIds(db),
  ]);
  const mine = memberships.get(userId) ?? [];
  return mine.find((id) => bookable.includes(id)) ?? null;
}

export interface TraineeRosterRow extends RosterRowLite {
  id: string;
  slot_id: string;
  source: "staff" | "self";
  trainers: { trainer_name: string; order_index: number }[] | null;
  location_he: string | null;
}

/** Every roster row of one trainee, with its slot's date, time, and branch. */
export async function loadTraineeRosterRows(db: SupabaseClient, userId: string): Promise<TraineeRosterRow[]> {
  const { data } = (await typedFrom(db, "daily_schedule_slot_trainees")
    .select(
      "id, slot_id, source, cancelled_at, late_cancel, slot:daily_schedule_slots!inner(schedule_date, start_time, branch_id, location_he, trainers:daily_schedule_slot_trainers(trainer_name, order_index))",
    )
    .eq("trainee_id", userId)) as {
    data:
      | {
          id: string;
          slot_id: string;
          source: "staff" | "self";
          cancelled_at: string | null;
          late_cancel: boolean;
          slot: {
            schedule_date: string;
            start_time: string;
            branch_id: string | null;
            trainers: { trainer_name: string; order_index: number }[] | null;
            location_he: string | null;
          } | null;
        }[]
      | null;
  };
  return (data ?? [])
    .filter((r) => r.slot)
    .map((r) => ({
      id: r.id,
      slot_id: r.slot_id,
      source: r.source,
      cancelled_at: r.cancelled_at,
      late_cancel: r.late_cancel,
      schedule_date: r.slot!.schedule_date,
      start_time: r.slot!.start_time,
      branch_id: r.slot!.branch_id,
      trainers: r.slot!.trainers,
      location_he: r.slot!.location_he,
    }));
}

export interface BookableSlotRow {
  id: string;
  schedule_date: string;
  start_time: string;
  trainers: { trainer_name: string; order_index: number }[] | null;
  focus_he: string | null;
  location_he: string | null;
  branch_id: string | null;
  max_trainees: number;
  seatsTaken: number;
}

/** Bookable slots (those with seats) of a branch in a date range, with seats taken. */
export async function loadBookableSlots(
  db: SupabaseClient,
  branchId: string,
  from: string,
  to: string,
): Promise<BookableSlotRow[]> {
  const { data } = (await typedFrom(db, "daily_schedule_slots")
    .select(
      "id, schedule_date, start_time, focus_he, location_he, branch_id, max_trainees, trainers:daily_schedule_slot_trainers(trainer_name, order_index), trainees:daily_schedule_slot_trainees(cancelled_at)",
    )
    .eq("branch_id", branchId)
    .not("max_trainees", "is", null)
    .gte("schedule_date", from)
    .lte("schedule_date", to)
    .order("schedule_date")
    .order("start_time")) as {
    data:
      | (Omit<BookableSlotRow, "seatsTaken"> & { trainees: { cancelled_at: string | null }[] | null })[]
      | null;
  };
  return (data ?? []).map(({ trainees, ...slot }) => ({
    ...slot,
    seatsTaken: (trainees ?? []).filter((t) => t.cancelled_at === null).length,
  }));
}
