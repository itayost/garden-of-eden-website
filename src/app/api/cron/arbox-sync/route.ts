import { NextRequest, NextResponse } from "next/server";
import { syncArboxUsers } from "@/lib/arbox/sync";

/**
 * Vercel Cron Job: Sync Arbox members to Supabase trainee accounts.
 *
 * Runs nightly at 2am UTC. Fetches all Arbox users, creates new auth accounts
 * for unmatched members (with phones), and fills null profile fields for existing ones.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[Arbox Sync] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ARBOX_API_KEY) {
    console.error("[Arbox Sync] ARBOX_API_KEY env var is not set");
    return NextResponse.json({ error: "ARBOX_API_KEY not configured" }, { status: 500 });
  }

  try {
    const result = await syncArboxUsers();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Arbox Sync] Fatal error:", error);
    return NextResponse.json(
      { error: "Sync failed", details: String(error) },
      { status: 500 }
    );
  }
}
