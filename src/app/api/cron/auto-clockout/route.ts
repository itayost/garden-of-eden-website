import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getIsraelTime,
  getAutoClockoutHour,
} from "@/lib/utils/israel-time";

/**
 * Vercel Cron Job: Auto clock-out active shifts.
 *
 * Runs every 10 minutes. Checks current Israel time and:
 * - Saturday: does nothing
 * - Friday at/after 15:00: ends all active shifts
 * - Sun-Thu at/after 20:00: ends all active shifts
 *
 * Idempotent: only affects shifts where end_time IS NULL.
 */
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

  if (targetHour === null || israelTime.hour < targetHour) {
    return NextResponse.json({
      success: true,
      action: "skipped",
      reason:
        targetHour === null
          ? "Saturday - no auto-clockout"
          : `Not yet ${targetHour}:00 Israel time (current: ${israelTime.hour}:${String(israelTime.minute).padStart(2, "0")})`,
    });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Trainers excluded from scheduled auto clock-out (manage their own hours)
  const EXCLUDED_TRAINER_IDS = [
    "15f0cf63-0306-4186-9a7f-51ef21a39117", // עידו ברק
  ];

  // Fetch active shift IDs first for logging (excluding specific trainers)
  const { data: activeShifts, error: fetchError } = await supabase
    .from("trainer_shifts")
    .select("id, trainer_id, trainer_name, start_time")
    .is("end_time", null)
    .not("trainer_id", "in", `(${EXCLUDED_TRAINER_IDS.join(",")})`);

  if (fetchError) {
    console.error("[Auto-Clockout] Error fetching active shifts:", fetchError);
    return NextResponse.json(
      { error: "Failed to fetch active shifts" },
      { status: 500 }
    );
  }

  if (!activeShifts || activeShifts.length === 0) {
    console.log(
      "[Auto-Clockout] No active shifts to end" +
        (EXCLUDED_TRAINER_IDS.length > 0
          ? ` (${EXCLUDED_TRAINER_IDS.length} trainer(s) excluded)`
          : "")
    );
    return NextResponse.json({
      success: true,
      action: "no_active_shifts",
      ended: 0,
    });
  }

  const shiftIds = activeShifts.map((s) => s.id);

  console.log(
    `[Auto-Clockout] Ending ${activeShifts.length} active shift(s):`,
    activeShifts
      .map((s) => `${s.trainer_name} (${s.id})`)
      .join(", ")
  );

  // Atomic update: target specific IDs with end_time IS NULL guard
  // This prevents overwriting a shift that was manually clocked out between fetch and update
  const { data: updatedShifts, error: updateError } = await supabase
    .from("trainer_shifts")
    .update({
      end_time: now,
      auto_ended: true,
      flagged_for_review: true,
    })
    .in("id", shiftIds)
    .is("end_time", null)
    .select("id");

  if (updateError) {
    console.error("[Auto-Clockout] Error ending shifts:", updateError);
    return NextResponse.json(
      { error: "Failed to end shifts" },
      { status: 500 }
    );
  }

  const endedCount = updatedShifts?.length ?? 0;

  console.log(`[Auto-Clockout] Successfully ended ${endedCount} shift(s)`);

  return NextResponse.json({
    success: true,
    action: "ended_shifts",
    ended: endedCount,
    attempted: activeShifts.length,
  });
}
