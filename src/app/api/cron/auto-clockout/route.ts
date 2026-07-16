import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getIsraelTime,
  getAutoClockoutHour,
} from "@/lib/utils/israel-time";
import {
  MORNING_SHIFT_END_HOUR,
  type ShiftPeriod,
} from "@/lib/constants/shifts";

/**
 * Vercel Cron Job: Auto clock-out active shifts.
 *
 * Runs every 10 minutes and performs two independent sweeps:
 *
 * - Morning sweep: at/after 11:00 Israel time, ends active shifts marked
 *   shift_period = 'morning'. Runs on any day except Friday, independent of
 *   the day sweep — a forgotten morning shift must not sit open until the
 *   evening cutoff and land as a ~12-hour shift.
 * - Day sweep: the original whole-day cutoff.
 *     - Saturday: does nothing
 *     - Friday at/after 15:00: ends all active shifts
 *     - Sun-Thu at/after 20:00: ends all active shifts
 *
 * Idempotent: only affects shifts where end_time IS NULL.
 */

// Trainers excluded from scheduled auto clock-out (manage their own hours)
const EXCLUDED_TRAINER_IDS = [
  "15f0cf63-0306-4186-9a7f-51ef21a39117", // עידו ברק
];

const FRIDAY = 5;

interface SweepResult {
  ended: number;
  attempted: number;
  error?: string;
}

/**
 * Ends this sweep's active shifts, optionally narrowed to one period,
 * guarding against shifts manually clocked out between fetch and update.
 */
async function endActiveShifts(
  supabase: ReturnType<typeof createAdminClient>,
  label: string,
  period?: ShiftPeriod
): Promise<SweepResult> {
  const query = supabase
    .from("trainer_shifts")
    .select("id, trainer_id, trainer_name, start_time")
    .is("end_time", null)
    .not("trainer_id", "in", `(${EXCLUDED_TRAINER_IDS.join(",")})`);

  const { data: activeShifts, error: fetchError } = await (period
    ? query.eq("shift_period", period)
    : query);

  if (fetchError) {
    console.error(`[Auto-Clockout] ${label}: error fetching shifts:`, fetchError);
    return { ended: 0, attempted: 0, error: "fetch_failed" };
  }

  if (!activeShifts || activeShifts.length === 0) {
    console.log(`[Auto-Clockout] ${label}: no active shifts to end`);
    return { ended: 0, attempted: 0 };
  }

  const shiftIds = activeShifts.map((s) => s.id);

  console.log(
    `[Auto-Clockout] ${label}: ending ${activeShifts.length} shift(s): ` +
      activeShifts.map((s) => `${s.trainer_name} (${s.id})`).join(", ")
  );

  const { data: updatedShifts, error: updateError } = await supabase
    .from("trainer_shifts")
    .update({
      end_time: new Date().toISOString(),
      auto_ended: true,
      flagged_for_review: true,
    })
    .in("id", shiftIds)
    .is("end_time", null)
    .select("id");

  if (updateError) {
    console.error(`[Auto-Clockout] ${label}: error ending shifts:`, updateError);
    return { ended: 0, attempted: activeShifts.length, error: "update_failed" };
  }

  return {
    ended: updatedShifts?.length ?? 0,
    attempted: activeShifts.length,
  };
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[Auto-Clockout] CRON_SECRET env var is not set");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("[Auto-Clockout] Unauthorized request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const israelTime = getIsraelTime();
  const targetHour = getAutoClockoutHour(israelTime);

  console.log(
    `[Auto-Clockout] Israel time: ${israelTime.dateStr} ` +
      `day=${israelTime.dayOfWeek} hour=${israelTime.hour}:${String(israelTime.minute).padStart(2, "0")} ` +
      `targetHour=${targetHour}`
  );

  const supabase = createAdminClient();

  // Morning sweep — gated only on the morning cutoff, so it still runs on the
  // days and hours the day sweep skips.
  //
  // Skipped on Friday: that day is a single ~09:00-15:00 shift with no
  // morning/regular split, so nothing there should be ended at 11:00. Friday
  // shifts are never classified 'morning', but a row mislabelled by hand (or
  // by the brief window before this guard shipped) must fall to the 15:00 day
  // sweep rather than be force-ended four hours early.
  const morningDue =
    israelTime.dayOfWeek !== FRIDAY && israelTime.hour >= MORNING_SHIFT_END_HOUR;
  const morning: SweepResult = morningDue
    ? await endActiveShifts(supabase, "morning", "morning")
    : { ended: 0, attempted: 0 };

  // Day sweep — the original whole-day cutoff.
  const dayDue = targetHour !== null && israelTime.hour >= targetHour;
  const day: SweepResult = dayDue
    ? await endActiveShifts(supabase, "day")
    : { ended: 0, attempted: 0 };

  if (!morningDue && !dayDue) {
    return NextResponse.json({
      success: true,
      action: "skipped",
      reason:
        targetHour === null
          ? "Saturday - no auto-clockout, and before morning cutoff"
          : `Not yet ${targetHour}:00 Israel time (current: ${israelTime.hour}:${String(israelTime.minute).padStart(2, "0")})`,
    });
  }

  const ended = morning.ended + day.ended;
  console.log(
    `[Auto-Clockout] Successfully ended ${ended} shift(s) ` +
      `(morning=${morning.ended}, day=${day.ended})`
  );

  return NextResponse.json({
    success: true,
    action: ended > 0 ? "ended_shifts" : "no_active_shifts",
    ended,
    attempted: morning.attempted + day.attempted,
    sweeps: {
      morning: morningDue ? morning : "not_due",
      day: dayDue ? day : "not_due",
    },
  });
}
