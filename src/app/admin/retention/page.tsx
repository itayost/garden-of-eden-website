import type { Metadata } from "next";
import {
  getRetentionReportMonths,
  getRetentionReport,
  getRetentionNotes,
} from "@/lib/actions/admin-retention";
import { RetentionPageClient } from "@/components/admin/retention/RetentionPageClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/arbox/normalize-phone";

export const metadata: Metadata = {
  title: "שימור לקוחות | Garden of Eden",
};

export default async function RetentionPage() {
  const months = await getRetentionReportMonths();
  const latestMonth = months.length > 0 ? months[0].report_month : null;

  const [initialData, initialNotes] = latestMonth
    ? await Promise.all([
        getRetentionReport(latestMonth),
        getRetentionNotes(latestMonth),
      ])
    : [null, new Map()];

  const adminClient = createAdminClient();
  const { data: traineeRows } = await adminClient
    .from("profiles")
    .select("phone, position")
    .eq("role", "trainee")
    .not("phone", "is", null);

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
        initialMonth={latestMonth}
        initialData={initialData}
        initialNotes={initialNotes}
        traineePositions={traineePositions}
      />
    </div>
  );
}
