"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidDateString } from "@/lib/validations/common";
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

  // PostgREST does not order embedded rows; the roster order matters for the
  // WhatsApp text, so sort here once instead of in every consumer.
  const slots = ((data ?? []) as ScheduleSlot[]).map((slot) => ({
    ...slot,
    trainees: [...(slot.trainees ?? [])].sort(
      (a, b) => a.order_index - b.order_index,
    ),
  }));

  return { success: true, data: slots };
}
