import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { buildRetentionReport, type RetentionReportData } from "./retention";

export interface PersistRetentionReportResult {
  readonly data: RetentionReportData;
  readonly refreshedAt: string;
}

export async function persistRetentionReport(
  reportMonth: string,
): Promise<PersistRetentionReportResult> {
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
