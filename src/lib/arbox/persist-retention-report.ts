import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isPastReportMonth } from "@/lib/utils/retention-month-list";
import {
  buildRetentionReport,
  mergeRetentionReports,
  type RetentionReportData,
} from "./retention";

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

  const fresh = await buildRetentionReport(reportMonth);

  const supabase = createAdminClient();
  const refreshedAt = new Date().toISOString();

  // Merge into the stored snapshot so members who already ended this month
  // (and are no longer returned by Arbox's expiring reports) are preserved
  // instead of being wiped on every refresh.
  const { data: existing, error: readError } = await typedFrom(
    supabase,
    "retention_reports",
  )
    .select("data")
    .eq("report_month", reportMonth)
    .maybeSingle();

  // Abort rather than silently fall back to a fresh-only (replace) write — a
  // transient read failure must not wipe already-ended members from the snapshot.
  if (readError) {
    throw new Error(
      `Failed to read existing retention report: ${readError.message}`,
    );
  }

  const storedData = (existing?.data ?? null) as RetentionReportData | null;
  const data = storedData
    ? mergeRetentionReports(storedData, fresh)
    : fresh;

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
