import { NextRequest, NextResponse } from "next/server";
import { runPlanReminders } from "@/features/plans/lib/reminders";
import { israelToday } from "@/lib/utils/tasks";
import { isReminderHour } from "@/lib/plans/reminder-hour";

export const maxDuration = 120;

/**
 * Daily at 09:00 Israel time: expire stale orders, send reminders. The cron
 * fires at 06:00 and 07:00 UTC; only the run in Israel's 09:00 hour works
 * (isReminderHour), so the time holds across daylight saving. ?force=1 runs now.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[plan-reminders] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isReminderHour(new Date()) && request.nextUrl.searchParams.get("force") !== "1") {
    return NextResponse.json({ success: true, skipped: "not 09:00 in Israel" });
  }

  try {
    const result = await runPlanReminders(israelToday());
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[plan-reminders] fatal:", error);
    return NextResponse.json({ error: "Run failed" }, { status: 500 });
  }
}
