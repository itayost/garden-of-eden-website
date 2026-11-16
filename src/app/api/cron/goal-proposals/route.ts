import { NextRequest, NextResponse } from "next/server";
import { proposeGoals } from "@/features/goal-proposals/lib/jobs/propose";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";

export const maxDuration = 300;

/**
 * No new Assessment is started after this, leaving a minute for the requests
 * in flight; an Assessment not started is due again on the next run, and one
 * cut off by the function's end stays unfinished and is retried.
 */
const PROPOSE_BUDGET_MS = 240_000;

/**
 * The nightly Goal proposals job (04:15 UTC, after the benchmarks and the
 * rating snapshots): expires stale proposals, then proposes Goals on the
 * Assessments that are due. There is no hour gate: what is due is decided by
 * the data, and every write is conditional, so a manual call is safe.
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  if (!process.env.CRON_SECRET) {
    console.error("[goal-proposals] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await proposeGoals(
      createAdminClient(),
      israelToday(new Date(startedAt)),
      startedAt + PROPOSE_BUDGET_MS,
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[goal-proposals] run failed:", error);
    return NextResponse.json({ error: "Run failed" }, { status: 500 });
  }
}
