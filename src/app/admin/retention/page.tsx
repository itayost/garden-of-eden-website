import type { Metadata } from "next";
import {
  getRetentionReportMonths,
  getRetentionReport,
  getRetentionNotes,
} from "@/lib/actions/admin-retention";
import { listChurnedCustomers } from "@/lib/actions/admin-churned-customers";
import { listTrainersForAssignmentAction } from "@/lib/actions/admin-trainers-list";
import { RetentionPageClient } from "@/components/admin/retention/RetentionPageClient";
import { loadEndingRetentionForCaller } from "@/lib/retention/ending-soon-load";
import { callerRetentionScope } from "@/lib/retention/scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/in-chunks";
import { normalizePhoneIL } from "@/lib/validations/common";
import {
  buildRetentionMonthOptions,
  getCurrentCalendarMonth,
} from "@/lib/utils/retention-month-list";

export const metadata: Metadata = {
  title: "שימור לקוחות | Garden of Eden",
};

const TABS = ["monthly", "pro", "training_card", "ending", "churned"] as const;

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function RetentionPage({ searchParams }: PageProps) {
  const { tab } = await searchParams;
  const initialTab = TABS.find((t) => t === tab) ?? "monthly";

  const [storedMonths, initialChurned, trainersRes, initialEnding] = await Promise.all([
    getRetentionReportMonths(),
    listChurnedCustomers(),
    listTrainersForAssignmentAction(),
    loadEndingRetentionForCaller(),
  ]);

  const trainers =
    "data" in trainersRes && trainersRes.data ? trainersRes.data : [];

  const currentCalendarMonth = getCurrentCalendarMonth();
  const months = buildRetentionMonthOptions(storedMonths, currentCalendarMonth);
  const initialMonth = currentCalendarMonth;
  const hasStoredRow = storedMonths.some(
    (m) => m.report_month === currentCalendarMonth,
  );

  const adminClient = createAdminClient();
  const traineeRowsPromise = readAllPages(() =>
    adminClient
      .from("profiles")
      .select("id, phone, position")
      .eq("role", "trainee")
      .not("phone", "is", null)
      .order("id"),
  );

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

  // Positions feed the עמדה filter. Keyed by phone, so a trainer gets only
  // the trainees in their branches, as with every other row on the page.
  const scope = await callerRetentionScope();
  const traineeRows = (traineeRowsResult.data ?? []).filter(
    (row) => scope === null || (!("error" in scope) && scope.profileIds.has(row.id)),
  );

  // Branch scope is applied on the server, by getRetentionReport and the
  // refresh action; the report the client gets holds only the caller's rows.

  const traineePositions: Record<string, string | null> = {};
  for (const row of traineeRows) {
    const normalized = normalizePhoneIL(row.phone);
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
        currentMonth={currentCalendarMonth}
        initialData={initialData}
        initialNotes={initialNotes}
        initialChurned={initialChurned}
        traineePositions={traineePositions}
        trainers={trainers}
        initialEnding={initialEnding}
        initialTab={initialTab}
      />
    </div>
  );
}
