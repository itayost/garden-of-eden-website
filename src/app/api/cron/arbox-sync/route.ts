import { NextRequest, NextResponse } from "next/server";
import { syncArboxUsers, syncArboxBirthdays } from "@/lib/arbox/sync";
import { syncCourseAccess } from "@/lib/arbox/sync-access";
import { runArboxPurchaseImport, type ImportRunResult } from "@/features/plans/lib/arbox-import";
import { revalidateStaffSurfaces } from "@/features/plans/lib/revalidate-staff";

// The access step alone makes ~50 serial Arbox calls; the default limit is not
// enough, and a timeout would discard the two steps that already succeeded.
export const maxDuration = 300;

/**
 * Vercel Cron Job: Sync Arbox members to Supabase trainee accounts.
 *
 * Runs nightly at 2am UTC. Fetches all Arbox users, creates new auth accounts
 * for unmatched members (with phones), and fills null profile fields for existing ones.
 * Also syncs birthdays from the Arbox birthday report into profiles.birthdate,
 * and each trainee's purchase facts, which decide who sees only the digital
 * course. With ARBOX_IMPORT_PURCHASES=on it then imports new Arbox cards and
 * memberships of קריית אתא trainees into their plans.
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
    // Isolated: this step is the long one, and its failure must not throw away
    // the user and birthday results that already landed.
    let accessResult: Awaited<ReturnType<typeof syncCourseAccess>> | null = null;
    let accessError: string | null = null;
    try {
      accessResult = await syncCourseAccess();
    } catch (error) {
      accessError = error instanceof Error ? error.message : String(error);
      console.error("[Arbox Sync] Access sync failed:", accessError);
    }

    // Runs last: it needs the links the user step just made. Behind a flag
    // until the owner approves a dry run; isolated like the access step.
    let purchasesResult: ImportRunResult | null = null;
    let purchasesError: string | null = null;
    if (process.env.ARBOX_IMPORT_PURCHASES === "on") {
      try {
        const { result } = await runArboxPurchaseImport({ dryRun: false });
        purchasesResult = result;
        result.touchedProfileIds.forEach(revalidateStaffSurfaces);
        if (result.pastTheirEnd > 0) {
          console.warn(`[Arbox Sync] ${result.pastTheirEnd} imported plan(s) queued past their Arbox end; check the trainees' plans`);
        }
      } catch (error) {
        purchasesError = error instanceof Error ? error.message : String(error);
        console.error("[Arbox Sync] Purchase import failed:", purchasesError);
      }
    }

    return NextResponse.json({
      success: true,
      users: usersResult,
      birthdays: birthdayResult,
      access: accessResult,
      accessError,
      purchases: purchasesResult,
      purchasesError,
    });
  } catch (error) {
    console.error("[Arbox Sync] Fatal error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
