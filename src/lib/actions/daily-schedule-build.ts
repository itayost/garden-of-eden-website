"use server";

import { verifyAdmin } from "@/lib/actions/shared";
import { revalidateScheduleSurfaces } from "@/lib/actions/shared/revalidate-schedule";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { addDays } from "@/lib/utils/iso-date";
import { buildWeek, isBuildableDay } from "@/lib/utils/schedule-week";
import { israelToday } from "@/lib/utils/tasks";
import { deriveOnDuty } from "@/lib/utils/weekly-schedule";
import {
  buildDaySchema,
  buildWeekSchema,
  type BuildDayInput,
  type BuildWeekInput,
} from "@/lib/validations/weekly-schedule";
import { SLOT_SELECT_WITH_TRAINEES, type ScheduleSlot } from "@/types/schedule";
import type { OnDuty, WeeklyBand, WeeklyException } from "@/types/weekly-schedule";

type BuildResult =
  | { success: true; count: number }
  | { error: string; fieldErrors?: Record<string, string[]> };

type BuildWeekResult =
  | { success: true; count: number; dayCount: number }
  | { error: string; fieldErrors?: Record<string, string[]> };

/**
 * One slot row per working stretch, at the stretch's start hour.
 *
 * Standby is already excluded: deriveOnDuty splits it out, and onDuty.bands
 * holds only what someone decided is happening.
 */
function slotRowsFor(date: string, onDuty: OnDuty, userId: string) {
  return onDuty.bands.map((band) => ({
    schedule_date: date,
    start_time: band.startTime,
    trainer_id: band.trainerId,
    trainer_name: band.trainerName,
    // The stretch's label is what this group is ("ילדים א׳"), which is what the
    // focus field carries. A stretch with no label leaves it for the trainer.
    focus_he: band.labelHe,
    location_he: band.locationHe,
    created_by: userId,
  }));
}

/**
 * Seeds a day's board from the weekly schedule: one slot per working stretch
 * that day, at the stretch's start hour, carrying the trainer, the location and
 * the stretch's label as the focus — and no roster.
 *
 * The names are the part the week cannot know, so they stay the human's job.
 * That is why this does not go through slotSchema, which requires at least one
 * roster entry: that rule guards what a person saves through the form and
 * should keep guarding it. A seeded slot is explicitly half-built, says so on
 * the card, and forces the names in the moment anyone opens it to edit.
 *
 * Standby stretches are skipped. "חיזוק במידת הצורך" means nobody has decided
 * it is happening, and a slot on the board asserts that it is.
 *
 * Admin-only and refuses a non-empty day, both matching duplicateDayAction:
 * rebuilding a whole day in one click is an admin decision, and "merge" has no
 * obvious meaning. As there, the gate is ergonomic rather than a containment
 * boundary — a trainer can still build the same day slot by slot.
 */
export async function buildDayFromWeeklyScheduleAction(
  input: BuildDayInput,
): Promise<BuildResult> {
  const { error: authError, user } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = buildDaySchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { date } = validated.data;
  const supabase = await createClient();

  const { data: targetExisting } = await typedFrom(supabase, "daily_schedule_slots")
    .select("id")
    .eq("schedule_date", date)
    .limit(1);

  if ((targetExisting?.length ?? 0) > 0) {
    return { error: "ליום זה כבר יש לוח. מחק אותו קודם או ערוך אותו ישירות." };
  }

  const [bandsResult, exceptionsResult] = await Promise.all([
    typedFrom(supabase, "weekly_schedule_bands").select("*"),
    typedFrom(supabase, "weekly_schedule_exceptions")
      .select("*")
      .eq("exception_date", date),
  ]);

  if (bandsResult.error || exceptionsResult.error) {
    console.error(
      "Build day fetch error:",
      bandsResult.error ?? exceptionsResult.error,
    );
    return { error: "שגיאה בטעינת הלוח השבועי" };
  }

  const onDuty = deriveOnDuty(
    date,
    (bandsResult.data ?? []) as WeeklyBand[],
    (exceptionsResult.data ?? []) as WeeklyException[],
  );

  if (onDuty.bands.length === 0) {
    return { error: "אין שיבוץ בלוח השבועי ליום זה" };
  }

  const rows = slotRowsFor(date, onDuty, user!.id);

  // One insert, unlike duplicateDayAction's loop: there is no roster to attach
  // per row, so the whole build is a single statement and either all of it
  // lands or none of it does. No compensating wipe is needed.
  const { data: created, error } = await typedFrom(supabase, "daily_schedule_slots")
    .insert(rows)
    .select("id");

  if (error) {
    console.error("Build day insert error:", error);
    return { error: "שגיאה בבניית הלוח" };
  }

  // An RLS-rejected insert returns no error and no rows; reporting that as a
  // successful build would leave the admin staring at an empty day.
  if ((created?.length ?? 0) === 0) {
    console.error("Build day returned no rows — check RLS insert policy");
    return { error: "שגיאה בבניית הלוח" };
  }

  revalidateScheduleSurfaces();

  return { success: true, count: created!.length };
}

/**
 * Seeds every unbuilt day of one week in a single statement.
 *
 * Sunday morning, the admin wants six boards, not six clicks. The rules are the
 * per-day build's rules applied six times: standby is skipped, seeded slots
 * carry no roster, and a day that already has a board is left exactly as it is
 * — skipped rather than refused, because "some of this week is already built"
 * is the normal case, not an error.
 *
 * Past days are skipped too. Backfilling one is legitimate, which is why the
 * per-day button still offers it, but writing today's template over a week that
 * already happened is not what a bulk button should do by default.
 *
 * Admin-only, as the per-day build is: rebuilding a whole week in one click is
 * an admin decision.
 */
export async function buildWeekFromWeeklyScheduleAction(
  input: BuildWeekInput,
): Promise<BuildWeekResult> {
  const { error: authError, user } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = buildWeekSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { weekStart } = validated.data;
  const weekEnd = addDays(weekStart, 6);
  const supabase = await createClient();

  const [slotsResult, bandsResult, exceptionsResult] = await Promise.all([
    typedFrom(supabase, "daily_schedule_slots")
      .select(SLOT_SELECT_WITH_TRAINEES)
      .gte("schedule_date", weekStart)
      .lte("schedule_date", weekEnd),
    typedFrom(supabase, "weekly_schedule_bands").select("*"),
    typedFrom(supabase, "weekly_schedule_exceptions")
      .select("*")
      .gte("exception_date", weekStart)
      .lte("exception_date", weekEnd),
  ]);

  if (slotsResult.error || bandsResult.error || exceptionsResult.error) {
    console.error(
      "Build week fetch error:",
      slotsResult.error ?? bandsResult.error ?? exceptionsResult.error,
    );
    return { error: "שגיאה בטעינת הלוח השבועי" };
  }

  // Saturday is excluded by buildWeek's grid: the academy does not staff it, so
  // it carries no bands and would contribute nothing to a bulk seed.
  const { days } = buildWeek({
    weekStart,
    today: israelToday(),
    slots: (slotsResult.data ?? []) as ScheduleSlot[],
    bands: (bandsResult.data ?? []) as WeeklyBand[],
    exceptions: (exceptionsResult.data ?? []) as WeeklyException[],
  });

  const buildable = days.filter(isBuildableDay);

  if (buildable.length === 0) {
    return { error: "אין ימים לבנות בשבוע הזה" };
  }

  const rows = buildable.flatMap((day) =>
    slotRowsFor(day.date, day.onDuty, user!.id),
  );

  const { data: created, error } = await typedFrom(supabase, "daily_schedule_slots")
    .insert(rows)
    .select("id");

  if (error) {
    console.error("Build week insert error:", error);
    return { error: "שגיאה בבניית הלוח" };
  }

  // As in the per-day build: an RLS-rejected insert returns no error and no
  // rows, and reporting that as success would leave the week empty.
  if ((created?.length ?? 0) === 0) {
    console.error("Build week returned no rows — check RLS insert policy");
    return { error: "שגיאה בבניית הלוח" };
  }

  revalidateScheduleSurfaces();

  return {
    success: true,
    count: created!.length,
    dayCount: buildable.length,
  };
}
