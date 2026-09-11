import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import { bookableBranchIds, materializeBookableSlots } from "@/features/booking/lib/materialize";

export const maxDuration = 120;

/**
 * Daily at 03:30 Israel (01:30 UTC): project two weeks of bookable slots for
 * every branch that has bookable bands. Reminders run at 18:00 in their own cron.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[materialize-slots] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = createAdminClient();
    const today = israelToday();
    const branches = await bookableBranchIds(db);
    const results = [];
    for (const branchId of branches) {
      results.push({ branchId, ...(await materializeBookableSlots(db, branchId, today)) });
    }
    return NextResponse.json({ success: true, branches: results });
  } catch (error) {
    console.error("[materialize-slots] fatal:", error);
    return NextResponse.json({ error: "Run failed" }, { status: 500 });
  }
}
