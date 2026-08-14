"use server";

import { revalidatePath } from "next/cache";

import { verifyAdmin } from "@/lib/actions/shared";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { deriveOnDuty } from "@/lib/utils/weekly-schedule";
import { buildDaySchema, type BuildDayInput } from "@/lib/validations/weekly-schedule";
import type { WeeklyBand, WeeklyException } from "@/types/weekly-schedule";

type BuildResult =
  | { success: true; count: number }
  | { error: string; fieldErrors?: Record<string, string[]> };

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

  const rows = onDuty.bands.map((band) => ({
    schedule_date: date,
    start_time: band.startTime,
    trainer_id: band.trainerId,
    trainer_name: band.trainerName,
    // The stretch's label is what this group is ("ילדים א׳"), which is what the
    // focus field carries. A stretch with no label leaves it for the trainer.
    focus_he: band.labelHe,
    location_he: band.locationHe,
    created_by: user!.id,
  }));

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

  revalidatePath("/admin/schedule");

  return { success: true, count: created!.length };
}
