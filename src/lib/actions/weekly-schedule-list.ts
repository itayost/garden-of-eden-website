"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { deriveOnDuty } from "@/lib/utils/weekly-schedule";
import { isValidDateString } from "@/lib/validations/common";
import type {
  OnDuty,
  WeeklyBand,
  WeeklyException,
} from "@/types/weekly-schedule";

type BandsResult = { success: true; data: WeeklyBand[] } | { error: string };

type WeekResult =
  | { success: true; data: { bands: WeeklyBand[]; exceptions: WeeklyException[] } }
  | { error: string };

type OnDutyResult = { success: true; data: OnDuty } | { error: string };

/**
 * Every Band, all seven weekdays, ordered for display.
 *
 * The whole standing schedule is a few dozen rows — one query beats seven, and
 * the weekly editor renders all of it at once anyway.
 */
export async function getBandsAction(): Promise<BandsResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "weekly_schedule_bands")
    .select("*")
    .order("weekday", { ascending: true })
    .order("start_time", { ascending: true })
    .order("trainer_name", { ascending: true });

  if (error) {
    console.error("Get weekly bands error:", error);
    return { error: "שגיאה בטעינת הלוח השבועי" };
  }

  return { success: true, data: (data ?? []) as WeeklyBand[] };
}

/**
 * The standing week plus the Exceptions in a date window, for the weekly
 * editor. The window is bounded so the exceptions list does not grow without
 * limit as the season goes on.
 */
export async function getWeeklyScheduleAction(
  fromDate: string,
  toDate: string,
): Promise<WeekResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidDateString(fromDate) || !isValidDateString(toDate)) {
    return { error: "תאריך לא תקין" };
  }
  if (fromDate > toDate) return { error: "טווח תאריכים לא תקין" };

  const supabase = await createClient();

  const [bandsResult, exceptionsResult] = await Promise.all([
    typedFrom(supabase, "weekly_schedule_bands")
      .select("*")
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true })
      .order("trainer_name", { ascending: true }),
    typedFrom(supabase, "weekly_schedule_exceptions")
      .select("*")
      .gte("exception_date", fromDate)
      .lte("exception_date", toDate)
      .order("exception_date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: true }),
  ]);

  if (bandsResult.error || exceptionsResult.error) {
    console.error(
      "Get weekly schedule error:",
      bandsResult.error ?? exceptionsResult.error,
    );
    return { error: "שגיאה בטעינת הלוח השבועי" };
  }

  return {
    success: true,
    data: {
      bands: (bandsResult.data ?? []) as WeeklyBand[],
      exceptions: (exceptionsResult.data ?? []) as WeeklyException[],
    },
  };
}

/**
 * The staffing in force on one date — the daily board's on-duty strip and the
 * slot form's trainer default both read this.
 *
 * Derivation happens here rather than in the page so every caller gets the same
 * answer; the rule itself lives in lib/utils/weekly-schedule.ts.
 */
export async function getOnDutyAction(date: string): Promise<OnDutyResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidDateString(date)) return { error: "תאריך לא תקין" };

  const supabase = await createClient();

  const [bandsResult, exceptionsResult] = await Promise.all([
    typedFrom(supabase, "weekly_schedule_bands").select("*"),
    typedFrom(supabase, "weekly_schedule_exceptions")
      .select("*")
      .eq("exception_date", date),
  ]);

  if (bandsResult.error || exceptionsResult.error) {
    console.error(
      "Get on-duty error:",
      bandsResult.error ?? exceptionsResult.error,
    );
    return { error: "שגיאה בטעינת שיבוץ המאמנים" };
  }

  return {
    success: true,
    data: deriveOnDuty(
      date,
      (bandsResult.data ?? []) as WeeklyBand[],
      (exceptionsResult.data ?? []) as WeeklyException[],
    ),
  };
}
