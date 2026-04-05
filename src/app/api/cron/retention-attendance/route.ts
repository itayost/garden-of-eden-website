import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { fetchBookingsReport } from "@/lib/arbox/retention";
import type {
  RetentionReportData,
  RetentionEntry,
  BookingEntry,
} from "@/lib/arbox/retention";
import { normalizePhone } from "@/lib/arbox/normalize-phone";

export const maxDuration = 60;

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function countAttendanceForMember(
  memberUserId: number | null,
  memberPhone: string | null,
  memberName: string,
  bookings: readonly BookingEntry[],
): number | null {
  const normalizedPhone = normalizePhone(memberPhone);
  const normalizedName = normalizeName(memberName);

  let count = 0;
  for (const b of bookings) {
    if (b.check_in !== "Yes") continue;

    const match =
      (memberUserId != null && b.user_id === memberUserId) ||
      (normalizedPhone != null && normalizePhone(b.phone) === normalizedPhone) ||
      normalizeName(b.name) === normalizedName;

    if (match) count++;
  }

  return count > 0 ? count : null;
}

function formatDateYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function updateAttendanceInEntries(
  entries: readonly RetentionEntry[],
  bookings: readonly BookingEntry[],
): readonly RetentionEntry[] {
  return entries.map((entry) => {
    const currentMonthCount = countAttendanceForMember(
      entry.user_id,
      entry.phone,
      entry.name,
      bookings,
    );

    // Build new attendance array: index 0 = current month, rest stays the same
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
    // Current month report
    const now = new Date();
    const reportMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

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

    // Fetch current month bookings
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const bookings = await fetchBookingsReport(
      formatDateYMD(firstDay),
      formatDateYMD(lastDay),
    );

    console.log(
      `[Retention Attendance] Fetched ${bookings.length} bookings for ${reportMonth}`,
    );

    // Update attendance[0] for each category
    const updatedData: RetentionReportData = {
      monthly: updateAttendanceInEntries(reportData.monthly, bookings),
      pro: updateAttendanceInEntries(reportData.pro, bookings),
      training_card: updateAttendanceInEntries(
        reportData.training_card,
        bookings,
      ),
    };

    // Save back
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
