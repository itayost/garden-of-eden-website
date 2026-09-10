import type { Metadata } from "next";
import {
  getRetentionReportMonths,
  getRetentionReport,
  getRetentionNotes,
} from "@/lib/actions/admin-retention";
import { listChurnedCustomers } from "@/lib/actions/admin-churned-customers";
import { listTrainersForAssignmentAction } from "@/lib/actions/admin-trainers-list";
import { RetentionPageClient } from "@/components/admin/retention/RetentionPageClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/arbox/normalize-phone";
import { getBranchScopeAction } from "@/lib/actions/shared";
import { scopedProfileIds } from "@/features/branches/lib/memberships";
import {
  buildRetentionMonthOptions,
  getCurrentCalendarMonth,
} from "@/lib/utils/retention-month-list";

export const metadata: Metadata = {
  title: "שימור לקוחות | Garden of Eden",
};

export default async function RetentionPage() {
  const [storedMonths, initialChurned, trainersRes] = await Promise.all([
    getRetentionReportMonths(),
    listChurnedCustomers(),
    listTrainersForAssignmentAction(),
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
  const traineeRowsPromise = adminClient
    .from("profiles")
    .select("id, phone, position")
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

  // Retention rows come from Arbox keyed by phone, so a trainer's scope maps
  // their visible trainees to phones and the client filters the entries.
  const scopeResult = await getBranchScopeAction();
  const scope = "success" in scopeResult ? scopeResult.data.scope : { kind: "all" as const };
  const scopedIds = await scopedProfileIds(adminClient, scope);
  const visiblePhones =
    scopedIds === null
      ? null
      : (traineeRows ?? [])
          .filter((row) => scopedIds.includes(row.id))
          .map((row) => normalizePhone(row.phone))
          .filter((phone): phone is string => phone !== null);

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
        visiblePhones={visiblePhones}
        months={months}
        initialMonth={initialMonth}
        currentMonth={currentCalendarMonth}
        initialData={initialData}
        initialNotes={initialNotes}
        initialChurned={initialChurned}
        traineePositions={traineePositions}
        trainers={trainers}
      />
    </div>
  );
}
