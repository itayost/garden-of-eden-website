import type { SupabaseClient } from "@supabase/supabase-js";

import { typedFrom } from "@/lib/supabase/helpers";
import type { SlotTombstone } from "@/lib/utils/schedule-week";

/**
 * A branch's tombstones in a date window: (band, date) pairs whose projected
 * slot staff deleted on purpose. Tombstones carry no branch; it comes from
 * the band. Shared by the calendar read and the day and week builds.
 */
export async function loadTombstones(
  db: SupabaseClient,
  branchId: string,
  fromDate: string,
  toDate: string,
): Promise<{ data: SlotTombstone[] } | { error: string }> {
  const { data, error } = (await typedFrom(db, "daily_schedule_slot_tombstones")
    .select("band_id, schedule_date, band:weekly_schedule_bands!inner(branch_id)")
    .eq("band.branch_id", branchId)
    .gte("schedule_date", fromDate)
    .lte("schedule_date", toDate)) as {
    data: { band_id: string; schedule_date: string }[] | null;
    error: { message: string } | null;
  };
  if (error) {
    console.error("Load tombstones error:", error.message);
    return { error: error.message };
  }
  return { data: (data ?? []).map((t) => ({ band_id: t.band_id, schedule_date: t.schedule_date })) };
}
