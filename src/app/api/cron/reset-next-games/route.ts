import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { todayInIsrael } from "@/lib/validations/next-game";

/**
 * Vercel Cron Job: Clear stale trainee next-game declarations.
 *
 * Runs daily at 01:00 UTC. Deletes every row whose game_date is before
 * today in Asia/Jerusalem. This naturally satisfies both "resets at the
 * start of every week" and "auto-clear after the game is played".
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[Reset Next Games] CRON_SECRET env var is not set");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("[Reset Next Games] Unauthorized request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoff = todayInIsrael();

  const { data, error } = await typedFrom(supabase, "trainee_next_games")
    .delete()
    .lt("game_date", cutoff)
    .select("id");

  if (error) {
    console.error("[Reset Next Games] delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const deleted = data?.length ?? 0;
  console.log(`[Reset Next Games] cutoff=${cutoff} deleted=${deleted}`);

  return NextResponse.json({ success: true, deleted, cutoff });
}
