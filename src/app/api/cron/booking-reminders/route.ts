import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import { sendBookingReminders } from "@/features/booking/lib/reminders";

export const maxDuration = 120;

/** Daily at 18:00 Israel (15:00 UTC): remind tomorrow's self-booked trainings. */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[booking-reminders] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendBookingReminders(createAdminClient(), israelToday());
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[booking-reminders] fatal:", error);
    return NextResponse.json({ error: "Run failed" }, { status: 500 });
  }
}
