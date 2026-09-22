import { trainerNames } from "@/lib/utils/trainer-color";
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { israelMinutesOfDay } from "@/lib/utils/israel-time";
import { israelToday } from "@/lib/utils/tasks";
import { cancelState } from "@/lib/schedule/booking-rules";
import type { MyBooking } from "./actions/schedule";
import { canBookForUser } from "./can-book";
import { loadTraineeRosterRows } from "./queries";

/** The next upcoming booking for the home card, without projecting slots. */
export async function loadNextBooking(userId: string): Promise<{ canBook: boolean; next: MyBooking | null }> {
  if (!(await canBookForUser(userId))) return { canBook: false, next: null };
  const today = israelToday();
  const now = { date: today, minutes: israelMinutesOfDay(new Date()) };
  const rows = await loadTraineeRosterRows(createAdminClient(), userId);
  const upcoming = rows
    .filter((r) => r.cancelled_at === null && r.schedule_date >= today)
    .sort((a, b) => `${a.schedule_date}${a.start_time}`.localeCompare(`${b.schedule_date}${b.start_time}`));
  const r = upcoming[0];
  if (!r) return { canBook: true, next: null };
  return {
    canBook: true,
    next: {
      slotId: r.slot_id,
      date: r.schedule_date,
      time: r.start_time.slice(0, 5),
      trainerName: trainerNames(r.trainers ?? []) || "הצוות",
      location: r.location_he,
      cancelState: cancelState(r.schedule_date, r.start_time, now),
      byStaff: r.source === "staff",
    },
  };
}
