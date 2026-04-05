"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import type { RetentionReportData } from "@/lib/arbox/retention";

export interface RetentionNote {
  readonly note: string;
  readonly author_id: string;
  readonly updated_at: string;
}

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

export async function getRetentionNotes(
  reportMonth: string,
): Promise<ReadonlyMap<string, RetentionNote>> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return new Map();

  const supabase = await createClient();
  const { data } = await typedFrom(supabase, "retention_notes")
    .select("trainee_phone, note, author_id, updated_at")
    .eq("report_month", reportMonth);

  const map = new Map<string, RetentionNote>();
  for (const row of data ?? []) {
    map.set(row.trainee_phone as string, {
      note: row.note as string,
      author_id: row.author_id as string,
      updated_at: row.updated_at as string,
    });
  }
  return map;
}

const upsertNoteSchema = z.object({
  reportMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  traineePhone: z.string().min(1),
  traineeName: z.string().min(1),
  note: z.string(),
});

export async function upsertRetentionNote(
  reportMonth: string,
  traineePhone: string,
  traineeName: string,
  note: string,
): Promise<{ error: string | null }> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const parsed = upsertNoteSchema.safeParse({
    reportMonth,
    traineePhone,
    traineeName,
    note,
  });
  if (!parsed.success) return { error: "קלט לא תקין" };

  const supabase = await createClient();

  // If note is empty, delete the row
  if (!note.trim()) {
    await typedFrom(supabase, "retention_notes")
      .delete()
      .eq("report_month", reportMonth)
      .eq("trainee_phone", traineePhone);
    return { error: null };
  }

  const { error: dbError } = await typedFrom(supabase, "retention_notes").upsert(
    {
      report_month: reportMonth,
      trainee_phone: traineePhone,
      trainee_name: traineeName,
      note: note.trim(),
      author_id: user!.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "report_month,trainee_phone" },
  );

  if (dbError) {
    console.error("[RetentionNotes] Upsert error:", dbError);
    return { error: "שגיאה בשמירת ההערה" };
  }

  return { error: null };
}
