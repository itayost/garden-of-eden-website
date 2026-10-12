"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertBranchReadable } from "@/lib/actions/shared/assert-branch";
import { birthYearOf } from "@/lib/schedule/roster-name";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidDateString, isValidUUID } from "@/lib/validations/common";
import { addDays } from "@/lib/utils/iso-date";
import { SLOT_SELECT_WITH_TRAINEES, type ScheduleSlot } from "@/types/schedule";

type ScheduleResult = { success: true; data: ScheduleSlot[] } | { error: string };

/**
 * All slots for one day, roster included, ordered by hour.
 * Staff-only; RLS additionally blocks trainees at the DB layer.
 */
export async function getScheduleAction(
  date: string,
  branchId: string,
): Promise<ScheduleResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidDateString(date)) return { error: "תאריך לא תקין" };
  if (!isValidUUID(branchId)) return { error: "מזהה סניף לא תקין" };
  const scopeCheck = await assertBranchReadable(branchId);
  if (scopeCheck.error) return { error: scopeCheck.error };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "daily_schedule_slots")
    .select(SLOT_SELECT_WITH_TRAINEES)
    .eq("branch_id", branchId)
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
  branchId: string,
): Promise<ScheduleResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidDateString(weekStart)) return { error: "תאריך לא תקין" };
  if (!isValidUUID(branchId)) return { error: "מזהה סניף לא תקין" };
  const scopeCheck = await assertBranchReadable(branchId);
  if (scopeCheck.error) return { error: scopeCheck.error };

  const supabase = await createClient();
  // idx_schedule_slots_date is (schedule_date, start_time), so the range scan
  // and this ordering are the same shape as the single-day read.
  const { data, error } = await typedFrom(supabase, "daily_schedule_slots")
    .select(SLOT_SELECT_WITH_TRAINEES)
    .eq("branch_id", branchId)
    .gte("schedule_date", weekStart)
    .lte("schedule_date", addDays(weekStart, 6))
    .order("schedule_date", { ascending: true })
    .order("start_time", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Get week schedule error:", error);
    return { error: "שגיאה בטעינת הלוח" };
  }

  return { success: true, data: await withProfileMarks(withSortedRoster(data)) };
}

/**
 * Each linked roster name's birth year and A mark, so the calendar can show
 * "יונתן 08 A". Service role: the profiles policies hide trainee rows from a trainer, and
 * the caller has already checked staff access and branch scope; only those
 * two columns are read. A failed read leaves the names bare rather than failing
 * the calendar.
 */
async function withProfileMarks(slots: ScheduleSlot[]): Promise<ScheduleSlot[]> {
  const ids = Array.from(
    new Set(slots.flatMap((slot) => slot.trainees.flatMap((t) => (t.trainee_id ? [t.trainee_id] : [])))),
  );
  if (ids.length === 0) return slots;

  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, birthdate, plays_up")
    .in("id", ids);
  if (error) {
    console.error("Get roster profile marks error:", error);
    return slots;
  }

  const profiles = new Map((data ?? []).map((profile) => [profile.id, profile]));
  return slots.map((slot) => ({
    ...slot,
    trainees: slot.trainees.map((t) => {
      const profile = t.trainee_id ? profiles.get(t.trainee_id) : undefined;
      return {
        ...t,
        birth_year: birthYearOf(profile?.birthdate ?? null),
        plays_up: profile?.plays_up ?? false,
      };
    }),
  }));
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
