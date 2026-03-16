import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AGE_GROUPS } from "@/types/assessment";

/**
 * Vercel Cron Job: Recalculate age group benchmarks for all groups.
 *
 * Runs daily at 3am UTC. Handles birthday-based age group transitions
 * that are not caught by DB triggers (since actual birthdays are not
 * DB events).
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[Benchmarks Cron] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const results: Record<string, string> = {};

  for (const group of AGE_GROUPS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)("recalculate_age_group_benchmarks", {
      p_age_group: group.id,
    });

    results[group.id] = error ? `error: ${error.message}` : "ok";

    if (error) {
      console.error(`[Benchmarks Cron] Failed to recalculate ${group.id}:`, error.message);
    }
  }

  return NextResponse.json({ results });
}
