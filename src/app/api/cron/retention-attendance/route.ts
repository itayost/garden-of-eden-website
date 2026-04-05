import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import {
  fetchBookingsReport,
  buildBookingIndex,
  lookupAttendance,
  formatDateYMD,
} from "@/lib/arbox/retention";
import type {
  RetentionReportData,
  RetentionEntry,
} from "@/lib/arbox/retention";

export const maxDuration = 60;

function updateAttendanceInEntries(
  entries: readonly RetentionEntry[],
  currentMonthKey: string,
  index: ReturnType<typeof buildBookingIndex>,
): readonly RetentionEntry[] {
  return entries.map((entry) => {
    const counts = lookupAttendance(
      entry.user_id,
      entry.phone,
      entry.name,
      index,
      [currentMonthKey],
    );
    const currentMonthCount = counts[0];

    // attendance[0] = current month (updated), rest stays the same
    const existingPrevious =
      entry.attendance.length > 1
        ? entry.attendance.slice(1)
        : entry.attendance;

    return {
      ...entry,
      attendance: [currentMonthCount, ...existingPrevious],
    };
  });
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[Retention Attendance] CRON_SECRET env var is not set");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ARBOX_API_KEY) {
    console.error("[Retention Attendance] ARBOX_API_KEY env var is not set");
    return NextResponse.json(
      { error: "ARBOX_API_KEY not configured" },
      { status: 500 },
    );
  }

  try {
    const now = new Date();
    const reportMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const supabase = createAdminClient();
    const { data: reportRow } = await typedFrom(supabase, "retention_reports")
      .select("data")
      .eq("report_month", reportMonth)
      .single();

    if (!reportRow) {
      console.log(
        `[Retention Attendance] No report found for ${reportMonth}, skipping`,
      );
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "no report",
      });
    }

    const reportData = reportRow.data as unknown as RetentionReportData;

    // Fetch current month bookings and build index for O(N+M) lookup
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const bookings = await fetchBookingsReport(
      formatDateYMD(firstDay),
      formatDateYMD(lastDay),
    );
    const bookingIndex = buildBookingIndex(bookings);

    console.log(
      `[Retention Attendance] Fetched ${bookings.length} bookings for ${reportMonth}`,
    );

    // Update attendance[0] for each category
    const updatedData: RetentionReportData = {
      monthly: updateAttendanceInEntries(reportData.monthly, currentMonthKey, bookingIndex),
      pro: updateAttendanceInEntries(reportData.pro, currentMonthKey, bookingIndex),
      training_card: updateAttendanceInEntries(
        reportData.training_card,
        currentMonthKey,
        bookingIndex,
      ),
    };

    const { error } = await typedFrom(supabase, "retention_reports")
      .update({
        data: updatedData as unknown as Record<string, unknown>,
      })
      .eq("report_month", reportMonth);

    if (error) {
      console.error("[Retention Attendance] Update error:", error);
      return NextResponse.json(
        { error: "Failed to update attendance" },
        { status: 500 },
      );
    }

    console.log(
      `[Retention Attendance] Updated current month attendance for ${reportMonth}`,
    );

    return NextResponse.json({
      success: true,
      report_month: reportMonth,
      bookings_fetched: bookings.length,
    });
  } catch (error) {
    console.error("[Retention Attendance] Fatal error:", error);
    return NextResponse.json(
      { error: "Attendance update failed" },
      { status: 500 },
    );
  }
}
