import { NextRequest, NextResponse } from "next/server";
import { sendWeek } from "@/features/weekly-reports/lib/jobs/send-week";
import { isSendWindow } from "@/features/weekly-reports/lib/report-week";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIsraelTime } from "@/lib/utils/israel-time";
import { israelToday } from "@/lib/utils/tasks";

export const maxDuration = 300;

/** No new row is claimed after this, so the function is never stopped mid-send. */
const SEND_BUDGET_MS = 240_000;

/**
 * Sends the current Report week's approved Weekly reports and "התגעגענו".
 * The send windows are Friday 12:00 and Sunday to Thursday 09:00 Israel time;
 * the crons fire at both UTC hours of each and only the run inside a window
 * works (isSendWindow), so the time holds across daylight saving and nothing
 * goes out on Friday afternoon or Shabbat. ?force=1 runs now. A second run
 * sends nothing twice: each row is claimed before it is sent.
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  if (!process.env.CRON_SECRET) {
    console.error("[weekly-reports-send] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date(startedAt);
  if (!isSendWindow(getIsraelTime(now)) && request.nextUrl.searchParams.get("force") !== "1") {
    return NextResponse.json({ success: true, skipped: "not a send window" });
  }

  try {
    const result = await sendWeek(createAdminClient(), israelToday(now), startedAt + SEND_BUDGET_MS);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[weekly-reports-send] fatal:", error);
    return NextResponse.json({ error: "Run failed" }, { status: 500 });
  }
}
