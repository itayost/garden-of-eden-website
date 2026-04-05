import type { Metadata } from "next";
import {
  getRetentionReportMonths,
  getRetentionReport,
  getRetentionNotes,
} from "@/lib/actions/admin-retention";
import { RetentionPageClient } from "@/components/admin/retention/RetentionPageClient";

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

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">שימור לקוחות</h1>
      <RetentionPageClient
        months={months}
        initialMonth={latestMonth}
        initialData={initialData}
        initialNotes={initialNotes}
      />
    </div>
  );
}
