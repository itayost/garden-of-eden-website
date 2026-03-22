"use server";

import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import type { RetentionReportData } from "@/lib/arbox/retention";

export interface RetentionReportMonth {
  readonly report_month: string;
  readonly created_at: string;
}

export async function getRetentionReportMonths(): Promise<
  readonly RetentionReportMonth[]
> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return [];

  const supabase = await createClient();
  const { data } = await typedFrom(supabase, "retention_reports")
    .select("report_month, created_at")
    .order("report_month", { ascending: false });

  return data ?? [];
}

export async function getRetentionReport(
  reportMonth: string,
): Promise<RetentionReportData | null> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return null;

  const supabase = await createClient();
  const { data } = await typedFrom(supabase, "retention_reports")
    .select("data")
    .eq("report_month", reportMonth)
    .single();

  if (!data) return null;

  return data.data as unknown as RetentionReportData;
}
