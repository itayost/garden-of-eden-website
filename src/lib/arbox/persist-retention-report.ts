import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isPastReportMonth } from "@/lib/utils/retention-month-list";
import { buildRetentionReport, type RetentionReportData } from "./retention";

export interface PersistRetentionReportResult {
  readonly data: RetentionReportData;
  readonly refreshedAt: string;
}

export async function persistRetentionReport(
  reportMonth: string,
): Promise<PersistRetentionReportResult> {
  // Safety net: a past month is a frozen snapshot and must never be rebuilt
  // (the cron only ever builds the current month, so it is unaffected).
  if (isPastReportMonth(reportMonth)) {
    throw new Error(
      `Refusing to overwrite frozen retention snapshot for past month ${reportMonth}`,
    );
  }

  const data = await buildRetentionReport(reportMonth);

  const supabase = createAdminClient();
  const refreshedAt = new Date().toISOString();

  const { error } = await typedFrom(supabase, "retention_reports").upsert(
    {
      report_month: reportMonth,
      data: data as unknown as Record<string, unknown>,
      created_at: refreshedAt,
    },
    { onConflict: "report_month" },
  );

  if (error) {
    throw new Error(`Failed to upsert retention report: ${error.message}`);
  }

  return { data, refreshedAt };
}
