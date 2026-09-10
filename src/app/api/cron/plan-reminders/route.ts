import { NextRequest, NextResponse } from "next/server";
import { runPlanReminders } from "@/features/plans/lib/reminders";
import { israelToday } from "@/lib/utils/tasks";

export const maxDuration = 120;

/** Daily at 07:00 Israel time (04:00 UTC): expire stale orders, send reminders. */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[plan-reminders] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runPlanReminders(israelToday());
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[plan-reminders] fatal:", error);
    return NextResponse.json({ error: "Run failed" }, { status: 500 });
  }
}
