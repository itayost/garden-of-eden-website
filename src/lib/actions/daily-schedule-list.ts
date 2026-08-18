"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidDateString } from "@/lib/validations/common";
import { addDays } from "@/lib/utils/iso-date";
import { SLOT_SELECT_WITH_TRAINEES, type ScheduleSlot } from "@/types/schedule";

type ScheduleResult = { success: true; data: ScheduleSlot[] } | { error: string };

/**
 * All slots for one day, roster included, ordered by hour.
 * Staff-only; RLS additionally blocks trainees at the DB layer.
 */
export async function getScheduleAction(date: string): Promise<ScheduleResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidDateString(date)) return { error: "תאריך לא תקין" };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "daily_schedule_slots")
    .select(SLOT_SELECT_WITH_TRAINEES)
    .eq("schedule_date", date)
    .order("start_time", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Get schedule error:", error);
    return { error: "שגיאה בטעינת הלוח" };
  }

  return { success: true, data: withSortedRoster(data) };
}

/**
 * All slots for the seven days from a week's Sunday, for the week view.
 *
 * Takes the week's start rather than a free range, so the span is seven days by
 * construction and there is nothing to cap: schedule_date is unbounded and the
 * select pulls the whole roster with it, so an open range would be a table dump
 * waiting for a bad URL.
 *
 * Returns the slots flat, the same shape as one day. Grouping them onto dates
 * is a pure operation and belongs in lib/utils/schedule-week.ts, where it is
 * tested; an action that returned a map would also have to decide what an empty
 * day looks like, which is a view's decision.
 */
export async function getSlotsForWeekAction(
  weekStart: string,
): Promise<ScheduleResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidDateString(weekStart)) return { error: "תאריך לא תקין" };

  const supabase = await createClient();
  // idx_schedule_slots_date is (schedule_date, start_time), so the range scan
  // and this ordering are the same shape as the single-day read.
  const { data, error } = await typedFrom(supabase, "daily_schedule_slots")
    .select(SLOT_SELECT_WITH_TRAINEES)
    .gte("schedule_date", weekStart)
    .lte("schedule_date", addDays(weekStart, 6))
    .order("schedule_date", { ascending: true })
    .order("start_time", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Get week schedule error:", error);
    return { error: "שגיאה בטעינת הלוח" };
  }

  return { success: true, data: withSortedRoster(data) };
}

/**
 * PostgREST does not order embedded rows, and the roster order is meaningful —
 * it drives the WhatsApp text and, in the week view, which names a truncated
 * card would show. Sorted here once instead of in every consumer.
 */
function withSortedRoster(data: unknown): ScheduleSlot[] {
  return ((data ?? []) as ScheduleSlot[]).map((slot) => ({
    ...slot,
    trainees: [...(slot.trainees ?? [])].sort(
      (a, b) => a.order_index - b.order_index,
    ),
  }));
}
