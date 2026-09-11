import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import { BOOKING_WINDOW_DAYS } from "@/lib/schedule/booking-rules";
import { key, materializationPlan } from "@/lib/schedule/materialization";
import { addDays } from "@/lib/utils/iso-date";
import type { WeeklyBand, WeeklyException } from "@/types/weekly-schedule";

/**
 * Projects the next BOOKING_WINDOW_DAYS of a branch's bookable bands into
 * rosterless slots, inserting only what is missing. Runs from the daily
 * cron and on demand when a trainee opens the schedule; both are cheap
 * because the plan is computed from four indexed reads.
 */
export async function materializeBookableSlots(
  db: SupabaseClient,
  branchId: string,
  today: string,
): Promise<{ inserted: number; error: string | null }> {
  const dates = Array.from({ length: BOOKING_WINDOW_DAYS + 1 }, (_, i) => addDays(today, i));
  const last = dates[dates.length - 1];

  const { data: bands, error: bandsError } = (await typedFrom(db, "weekly_schedule_bands")
    .select("*")
    .eq("branch_id", branchId)
    .eq("is_bookable", true)) as { data: WeeklyBand[] | null; error: { message: string } | null };
  if (bandsError) return { inserted: 0, error: bandsError.message };
  if (!bands || bands.length === 0) return { inserted: 0, error: null };
  const bandIds = bands.map((b) => b.id);

  const [exceptions, existing, tombstones] = await Promise.all([
    typedFrom(db, "weekly_schedule_exceptions")
      .select("*")
      .or(`branch_id.eq.${branchId},kind.eq.absent`)
      .gte("exception_date", today)
      .lte("exception_date", last) as unknown as Promise<{ data: WeeklyException[] | null }>,
    typedFrom(db, "daily_schedule_slots")
      .select("band_id, schedule_date")
      .in("band_id", bandIds)
      .gte("schedule_date", today)
      .lte("schedule_date", last) as unknown as Promise<{ data: { band_id: string; schedule_date: string }[] | null }>,
    typedFrom(db, "daily_schedule_slot_tombstones")
      .select("band_id, schedule_date")
      .in("band_id", bandIds)
      .gte("schedule_date", today)
      .lte("schedule_date", last) as unknown as Promise<{ data: { band_id: string; schedule_date: string }[] | null }>,
  ]);

  const plan = materializationPlan({
    dates,
    bands,
    exceptions: exceptions.data ?? [],
    existing: new Set((existing.data ?? []).map((s) => key(s.schedule_date, s.band_id))),
    tombstones: new Set((tombstones.data ?? []).map((t) => key(t.schedule_date, t.band_id))),
  });
  if (plan.length === 0) return { inserted: 0, error: null };

  const rows = plan.map(({ date, band }) => ({
    branch_id: branchId,
    band_id: band.id,
    schedule_date: date,
    start_time: band.start_time,
    trainer_id: band.trainer_id,
    trainer_name: band.trainer_name,
    focus_he: band.label_he,
    location_he: band.location_he,
    max_trainees: band.max_trainees,
    // The band's author stands as the slot's author: the projection is
    // theirs, made ahead of time.
    created_by: band.created_by,
  }));
  // Two runs at once (cron and a page load) race on the same rows; the
  // unique index on (band_id, schedule_date) makes the loser a no-op.
  const { data, error } = await typedFrom(db, "daily_schedule_slots")
    .upsert(rows, { onConflict: "band_id,schedule_date", ignoreDuplicates: true })
    .select("id");
  if (error) {
    console.error(`[materialize] insert failed for branch ${branchId}:`, error.message);
    return { inserted: 0, error: error.message };
  }
  return { inserted: data?.length ?? 0, error: null };
}

/** Branch ids that have at least one bookable band. */
export async function bookableBranchIds(db: SupabaseClient): Promise<string[]> {
  const { data } = (await typedFrom(db, "weekly_schedule_bands")
    .select("branch_id")
    .eq("is_bookable", true)
    .not("branch_id", "is", null)) as { data: { branch_id: string }[] | null };
  return Array.from(new Set((data ?? []).map((b) => b.branch_id)));
}
