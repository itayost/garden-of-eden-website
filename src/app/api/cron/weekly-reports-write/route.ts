import { NextRequest, NextResponse } from "next/server";
import { finishWeek, startWeek } from "@/features/weekly-reports/lib/jobs/write-week";
import { writePhase } from "@/features/weekly-reports/lib/report-week";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIsraelTime } from "@/lib/utils/israel-time";
import { israelToday } from "@/lib/utils/tasks";

export const maxDuration = 300;

/**
 * No new direct request starts after this, leaving a minute for the ones in
 * flight; a request cut off by the function's end is written by the next run.
 */
const FINISH_BUDGET_MS = 240_000;

const PHASES = ["start", "finish"] as const;
type Phase = (typeof PHASES)[number];

function isPhase(value: string): value is Phase {
  return PHASES.some((phase) => phase === value);
}

/**
 * Writes the current Report week's Weekly reports. "start" (Friday 01:00
 * Israel time) makes the week's rows and sends the batch; "finish" (Friday
 * 07:30 to 11:59, every half hour) collects it and writes what is missing
 * with direct requests. The crons fire at the UTC hours of both seasons and
 * only a run inside a phase works (writePhase), so the times hold across
 * daylight saving. ?phase=start or ?phase=finish runs that phase now.
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  if (!process.env.CRON_SECRET) {
    console.error("[weekly-reports-write] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date(startedAt);
  const asked = request.nextUrl.searchParams.get("phase");
  if (asked !== null && !isPhase(asked)) {
    return NextResponse.json({ error: "Unknown phase" }, { status: 400 });
  }
  const phase = asked ?? writePhase(getIsraelTime(now));
  if (phase === null) {
    return NextResponse.json({ success: true, skipped: "not a write hour" });
  }

  try {
    const db = createAdminClient();
    const today = israelToday(now);
    const result =
      phase === "start" ? await startWeek(db, today) : await finishWeek(db, today, startedAt + FINISH_BUDGET_MS);
    return NextResponse.json({ success: true, phase, ...result });
  } catch (error) {
    console.error(`[weekly-reports-write] ${phase} failed:`, error);
    return NextResponse.json({ error: "Run failed" }, { status: 500 });
  }
}
