"use server";

import { verifyAdmin } from "@/lib/actions/shared";
import { revalidateScheduleSurfaces } from "@/lib/actions/shared/revalidate-schedule";
import { assertBranchWritable } from "@/lib/actions/shared/assert-branch";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { addDays } from "@/lib/utils/iso-date";
import { buildWeek, isBuildableDay, unbuiltBands } from "@/lib/utils/schedule-week";
import { israelToday } from "@/lib/utils/tasks";
import { deriveOnDuty } from "@/lib/utils/weekly-schedule";
import {
  buildDaySchema,
  buildWeekSchema,
  type BuildDayInput,
  type BuildWeekInput,
} from "@/lib/validations/weekly-schedule";
import { SLOT_SELECT_WITH_TRAINEES, type ScheduleSlot } from "@/types/schedule";
import {
  BAND_SELECT_WITH_TRAINERS,
  type OnDuty,
  type WeeklyBand,
  type WeeklyException,
} from "@/types/weekly-schedule";

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
function slotRowsFor(
  date: string,
  onDuty: OnDuty,
  userId: string,
  branchId: string,
) {
  // The id is generated here rather than by the default, so each row's
  // trainers can be written afterwards without depending on the order an
  // insert happens to return.
  return onDuty.bands.map((band) => ({
    id: crypto.randomUUID(),
    trainers: band.trainers,
    branch_id: branchId,
    schedule_date: date,
    start_time: band.startTime,
    // The stretch's label is what this group is ("ילדים א׳"), which is what the
    // focus field carries. A stretch with no label leaves it for the trainer.
    focus_he: band.labelHe,
    location_he: band.locationHe,
    band_id: band.source === "band" ? band.id : null,
    max_trainees: band.isBookable ? band.maxTrainees : null,
    created_by: userId,
  }));
}


/** The insert payload, and the staffing to attach once the rows land. */
function splitTrainers(rows: ReturnType<typeof slotRowsFor>) {
  const slotRows = rows.map((row) => {
    const { trainers, ...slotRow } = row;
    void trainers;
    return slotRow;
  });
  const trainerRows = rows.flatMap((row) =>
    row.trainers.map((trainer, index) => ({
      slot_id: row.id,
      trainer_id: trainer.id,
      trainer_name: trainer.name,
      order_index: index,
    })),
  );
  return { slotRows, trainerRows };
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
 * Admin-only, matching duplicateDayAction. It adds only the stretches that
 * have no slot yet (unbuiltBands): bookable hours are projected ahead of time,
 * so a day often already holds some of its slots, and refusing it would leave
 * the rest to be typed by hand. The gate is ergonomic rather than a
 * containment boundary — a trainer can still build the same day slot by slot.
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

  const { branchId, date } = validated.data;
  const supabase = await createClient();

  const branchCheck = await assertBranchWritable(branchId);
  if (branchCheck.error) return { error: branchCheck.error };

  const { data: targetExisting, error: existingError } = await typedFrom(supabase, "daily_schedule_slots")
    .select("band_id, start_time")
    .eq("branch_id", branchId)
    .eq("schedule_date", date);

  // A failed read must not read as "nothing there": building on top of an
  // unseen board would put every hour on it twice.
  if (existingError) {
    console.error("Build day existing slots error:", existingError);
    return { error: "שגיאה בטעינת הלוח" };
  }

  const [bandsResult, exceptionsResult] = await Promise.all([
    typedFrom(supabase, "weekly_schedule_bands")
      .select(BAND_SELECT_WITH_TRAINERS)
      .eq("branch_id", branchId)
      .order("order_index", { referencedTable: "trainers", ascending: true }),
    typedFrom(supabase, "weekly_schedule_exceptions")
      .select("*")
      .or(`branch_id.eq.${branchId},kind.eq.absent`)
      .eq("exception_date", date),
  ]);

  if (bandsResult.error || exceptionsResult.error) {
    console.error(
      "Build day fetch error:",
      bandsResult.error ?? exceptionsResult.error,
    );
    return { error: "שגיאה בטעינת התבנית השבועית" };
  }

  const onDuty = deriveOnDuty(
    date,
    (bandsResult.data ?? []) as WeeklyBand[],
    (exceptionsResult.data ?? []) as WeeklyException[],
  );

  if (onDuty.bands.length === 0) {
    return { error: "אין שיבוץ בתבנית השבועית ליום זה" };
  }

  const missing = unbuiltBands(
    onDuty.bands,
    (targetExisting ?? []) as { band_id: string | null; start_time: string }[],
  );
  if (missing.length === 0) {
    return { error: "כל השעות של היום כבר בלוח" };
  }

  const rows = slotRowsFor(date, { ...onDuty, bands: missing }, user!.id, branchId);

  // One insert, unlike duplicateDayAction's loop: there is no roster to attach
  // per row, so the whole build is a single statement and either all of it
  // lands or none of it does. No compensating wipe is needed.
  const { slotRows, trainerRows } = splitTrainers(rows);

  const { data: created, error } = await typedFrom(supabase, "daily_schedule_slots")
    .insert(slotRows)
    .select("id");

  if (error) {
    console.error("Build day insert error:", error);
    return { error: "שגיאה בבניית הלוח" };
  }

  if (trainerRows.length > 0) {
    const { error: trainerError } = await typedFrom(
      supabase,
      "daily_schedule_slot_trainers",
    ).insert(trainerRows);
    // The slots are on the board either way; a failed staffing write is
    // repaired by editing a slot, not by unwinding the build.
    if (trainerError) console.error("Build day insert error (trainers):", trainerError);
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
 * carry no roster, and a day's slots already on the board are left exactly as
 * they are; only its missing stretches are added. "Some of this week is
 * already there" is the normal case, not an error.
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

  const { branchId, weekStart } = validated.data;
  const weekEnd = addDays(weekStart, 6);
  const supabase = await createClient();

  const branchCheck = await assertBranchWritable(branchId);
  if (branchCheck.error) return { error: branchCheck.error };

  const [slotsResult, bandsResult, exceptionsResult] = await Promise.all([
    typedFrom(supabase, "daily_schedule_slots")
      .select(SLOT_SELECT_WITH_TRAINEES)
      .eq("branch_id", branchId)
      .gte("schedule_date", weekStart)
      .lte("schedule_date", weekEnd),
    typedFrom(supabase, "weekly_schedule_bands")
      .select(BAND_SELECT_WITH_TRAINERS)
      .eq("branch_id", branchId)
      .order("order_index", { referencedTable: "trainers", ascending: true }),
    typedFrom(supabase, "weekly_schedule_exceptions")
      .select("*")
      .or(`branch_id.eq.${branchId},kind.eq.absent`)
      .gte("exception_date", weekStart)
      .lte("exception_date", weekEnd),
  ]);

  if (slotsResult.error || bandsResult.error || exceptionsResult.error) {
    console.error(
      "Build week fetch error:",
      slotsResult.error ?? bandsResult.error ?? exceptionsResult.error,
    );
    return { error: "שגיאה בטעינת התבנית השבועית" };
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

  // Only each day's missing stretches: a day may already hold its projected
  // bookable hours, and those must not be inserted a second time.
  const rows = buildable.flatMap((day) =>
    slotRowsFor(day.date, { ...day.onDuty, bands: day.unbuiltBands }, user!.id, branchId),
  );

  const { slotRows, trainerRows } = splitTrainers(rows);

  const { data: created, error } = await typedFrom(supabase, "daily_schedule_slots")
    .insert(slotRows)
    .select("id");

  if (error) {
    console.error("Build week insert error:", error);
    return { error: "שגיאה בבניית הלוח" };
  }

  if (trainerRows.length > 0) {
    const { error: trainerError } = await typedFrom(
      supabase,
      "daily_schedule_slot_trainers",
    ).insert(trainerRows);
    // The slots are on the board either way; a failed staffing write is
    // repaired by editing a slot, not by unwinding the build.
    if (trainerError) console.error("Build week insert error (trainers):", trainerError);
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
