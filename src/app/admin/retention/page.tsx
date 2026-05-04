import type { Metadata } from "next";
import {
  getRetentionReportMonths,
  getRetentionReport,
  getRetentionNotes,
} from "@/lib/actions/admin-retention";
import { listChurnedCustomers } from "@/lib/actions/admin-churned-customers";
import { RetentionPageClient } from "@/components/admin/retention/RetentionPageClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/arbox/normalize-phone";
import { buildRetentionMonthOptions } from "@/lib/utils/retention-month-list";

export const metadata: Metadata = {
  title: "שימור לקוחות | Garden of Eden",
};

function getCurrentCalendarMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function RetentionPage() {
  const [storedMonths, initialChurned] = await Promise.all([
    getRetentionReportMonths(),
    listChurnedCustomers(),
  ]);

  const currentCalendarMonth = getCurrentCalendarMonth();
  const months = buildRetentionMonthOptions(storedMonths, currentCalendarMonth);
  const initialMonth = currentCalendarMonth;
  const hasStoredRow = storedMonths.some(
    (m) => m.report_month === currentCalendarMonth,
  );

  const adminClient = createAdminClient();
  const traineeRowsPromise = adminClient
    .from("profiles")
    .select("phone, position")
    .eq("role", "trainee")
    .not("phone", "is", null);

  const [initialData, initialNotes, traineeRowsResult] = hasStoredRow
    ? await Promise.all([
        getRetentionReport(initialMonth),
        getRetentionNotes(initialMonth),
        traineeRowsPromise,
      ])
    : [
        null,
        new Map<string, never>(),
        await traineeRowsPromise,
      ];

  const traineeRows = traineeRowsResult.data;

  const traineePositions: Record<string, string | null> = {};
  for (const row of traineeRows ?? []) {
    const normalized = normalizePhone(row.phone);
    if (normalized) {
      traineePositions[normalized] = row.position ?? null;
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">שימור לקוחות</h1>
      <RetentionPageClient
        months={months}
        initialMonth={initialMonth}
        initialData={initialData}
        initialNotes={initialNotes}
        initialChurned={initialChurned}
        traineePositions={traineePositions}
      />
    </div>
  );
}
