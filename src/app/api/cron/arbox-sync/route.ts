import { NextRequest, NextResponse } from "next/server";
import { syncArboxUsers, syncArboxBirthdays } from "@/lib/arbox/sync";
import { syncCourseAccess } from "@/lib/arbox/sync-access";

/**
 * Vercel Cron Job: Sync Arbox members to Supabase trainee accounts.
 *
 * Runs nightly at 2am UTC. Fetches all Arbox users, creates new auth accounts
 * for unmatched members (with phones), and fills null profile fields for existing ones.
 * Also syncs birthdays from the Arbox birthday report into profiles.birthdate,
 * and each trainee's purchase facts, which decide who sees only the digital
 * course.
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
    const usersResult = await syncArboxUsers();
    const birthdayResult = await syncArboxBirthdays();
    // Runs last: it classifies the profiles the two steps above may have just
    // created or linked.
    const accessResult = await syncCourseAccess();

    return NextResponse.json({
      success: true,
      users: usersResult,
      birthdays: birthdayResult,
      access: accessResult,
    });
  } catch (error) {
    console.error("[Arbox Sync] Fatal error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
