"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { getBranchScopeAction } from "@/lib/actions/shared/branch-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { visibleTraineePhones } from "@/features/branches/lib/memberships";
import { normalizePhone } from "@/lib/arbox/normalize-phone";
import type { RetentionEntry, RetentionReportData } from "@/lib/arbox/retention";
import { persistRetentionReport } from "@/lib/arbox/persist-retention-report";

/**
 * Retention rows are keyed by Arbox phone, so a trainer's branch scope is a
 * set of phones. Null means no restriction (admins, unassigned trainers).
 */
async function callerVisiblePhones(): Promise<Set<string> | null | { error: string }> {
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return { error: scopeResult.error };
  return visibleTraineePhones(createAdminClient(), scopeResult.data.scope);
}

function scopeReport(
  report: RetentionReportData,
  visible: Set<string> | null,
): RetentionReportData {
  if (visible === null) return report;
  const keep = (entry: RetentionEntry) => {
    const phone = normalizePhone(entry.phone);
    return phone !== null && visible.has(phone);
  };
  return {
    monthly: report.monthly.filter(keep),
    pro: report.pro.filter(keep),
    training_card: report.training_card.filter(keep),
  };
}

/** Trainers may annotate or reassign only customers inside their branches. */
async function assertPhoneInScope(traineePhone: string): Promise<string | null> {
  const visible = await callerVisiblePhones();
  if (visible instanceof Set || visible === null) {
    if (visible === null) return null;
    const phone = normalizePhone(traineePhone);
    return phone !== null && visible.has(phone) ? null : "הלקוח אינו בסניף שלך";
  }
  return visible.error;
}
import { isPastReportMonth } from "@/lib/utils/retention-month-list";
import { checkRateLimit, isAdminExempt } from "@/lib/rate-limit";
import {
  NOTE_COLORS,
  type NoteColor,
} from "@/lib/validations/churned-customers";

export interface RetentionNote {
  readonly note: string;
  readonly note_color: NoteColor;
  readonly author_id: string;
  readonly updated_at: string;
  readonly assigned_trainer_id: string | null;
}

export interface RetentionReportMonth {
  readonly report_month: string;
  readonly created_at: string | null;
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

  const visible = await callerVisiblePhones();
  if (!(visible instanceof Set) && visible !== null) return null;

  return scopeReport(data.data as unknown as RetentionReportData, visible);
}

export async function getRetentionNotes(
  reportMonth: string,
): Promise<ReadonlyMap<string, RetentionNote>> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return new Map();

  const supabase = await createClient();
  const { data } = await typedFrom(supabase, "retention_notes")
    .select(
      "trainee_phone, note, note_color, author_id, updated_at, assigned_trainer_id",
    )
    .eq("report_month", reportMonth);

  const map = new Map<string, RetentionNote>();
  for (const row of data ?? []) {
    map.set(row.trainee_phone as string, {
      note: row.note as string,
      note_color: (row.note_color ?? "none") as NoteColor,
      author_id: row.author_id as string,
      updated_at: row.updated_at as string,
      assigned_trainer_id: (row.assigned_trainer_id ?? null) as string | null,
    });
  }
  return map;
}

const upsertNoteSchema = z.object({
  reportMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  traineePhone: z.string().min(1),
  traineeName: z.string().min(1),
  note: z.string(),
  noteColor: z.enum(NOTE_COLORS).default("none"),
});

export async function upsertRetentionNote(
  reportMonth: string,
  traineePhone: string,
  traineeName: string,
  note: string,
  noteColor: NoteColor = "none",
): Promise<{ error: string | null }> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const scopeError = await assertPhoneInScope(traineePhone);
  if (scopeError) return { error: scopeError };

  const parsed = upsertNoteSchema.safeParse({
    reportMonth,
    traineePhone,
    traineeName,
    note,
    noteColor,
  });
  if (!parsed.success) return { error: "קלט לא תקין" };

  const supabase = await createClient();

  // Empty note + no color: delete the row only if no trainer is assigned —
  // otherwise keep the row so the assignment survives a cleared note.
  if (!note.trim() && noteColor === "none") {
    const { data: existing } = await typedFrom(supabase, "retention_notes")
      .select("assigned_trainer_id")
      .eq("report_month", reportMonth)
      .eq("trainee_phone", traineePhone)
      .maybeSingle();

    if (!existing || existing.assigned_trainer_id == null) {
      await typedFrom(supabase, "retention_notes")
        .delete()
        .eq("report_month", reportMonth)
        .eq("trainee_phone", traineePhone);
      return { error: null };
    }
    // Trainer still assigned — fall through to clear note/color, keep the row.
  }

  // updated_at is set by the set_retention_notes_updated_at trigger.
  const { error: dbError } = await typedFrom(supabase, "retention_notes").upsert(
    {
      report_month: reportMonth,
      trainee_phone: traineePhone,
      trainee_name: traineeName,
      note: note.trim(),
      note_color: noteColor,
      author_id: user!.id,
    },
    { onConflict: "report_month,trainee_phone" },
  );

  if (dbError) {
    console.error("[RetentionNotes] Upsert error:", dbError);
    return { error: "שגיאה בשמירת ההערה" };
  }

  return { error: null };
}

const setTrainerSchema = z.object({
  reportMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  traineePhone: z.string().min(1),
  traineeName: z.string().min(1),
  trainerId: z.string().uuid().nullable(),
});

/**
 * Assign (or clear) the trainer for a trainee in a given month's retention list.
 * Stored alongside the note in retention_notes; preserves any existing note/color.
 */
export async function setRetentionTrainer(
  reportMonth: string,
  traineePhone: string,
  traineeName: string,
  trainerId: string | null,
): Promise<{ error: string | null }> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const scopeError = await assertPhoneInScope(traineePhone);
  if (scopeError) return { error: scopeError };

  const parsed = setTrainerSchema.safeParse({
    reportMonth,
    traineePhone,
    traineeName,
    trainerId,
  });
  if (!parsed.success) return { error: "קלט לא תקין" };

  const supabase = await createClient();

  // Clearing the trainer with no note/color left: remove the row entirely.
  if (trainerId === null) {
    const { data: existing } = await typedFrom(supabase, "retention_notes")
      .select("note, note_color")
      .eq("report_month", reportMonth)
      .eq("trainee_phone", traineePhone)
      .maybeSingle();

    const hasNote =
      existing &&
      (((existing.note as string) ?? "").trim() !== "" ||
        ((existing.note_color as string) ?? "none") !== "none");

    if (!hasNote) {
      await typedFrom(supabase, "retention_notes")
        .delete()
        .eq("report_month", reportMonth)
        .eq("trainee_phone", traineePhone);
      return { error: null };
    }
  }

  // note/note_color are left untouched on the conflict path; updated_at is set
  // by the set_retention_notes_updated_at trigger.
  const { error: dbError } = await typedFrom(supabase, "retention_notes").upsert(
    {
      report_month: reportMonth,
      trainee_phone: traineePhone,
      trainee_name: traineeName,
      assigned_trainer_id: trainerId,
      author_id: user!.id,
    },
    { onConflict: "report_month,trainee_phone" },
  );

  if (dbError) {
    console.error("[RetentionTrainer] Upsert error:", dbError);
    return { error: "שגיאה בשיוך מאמן" };
  }

  return { error: null };
}

const reportMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-01$/, "פורמט חודש לא תקין");

export interface RefreshRetentionReportResult {
  readonly error: string | null;
  readonly data: RetentionReportData | null;
  readonly refreshedAt: string | null;
}

export async function refreshRetentionReport(
  reportMonth: string,
): Promise<RefreshRetentionReportResult> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) {
    return { error: authError, data: null, refreshedAt: null };
  }

  const parsed = reportMonthSchema.safeParse(reportMonth);
  if (!parsed.success) {
    return { error: "קלט לא תקין", data: null, refreshedAt: null };
  }

  // Past months are frozen snapshots — rebuilding from live Arbox data would
  // overwrite them with members whose end-dates have since moved forward.
  if (isPastReportMonth(parsed.data)) {
    return {
      error: "לא ניתן לעדכן דוח של חודש שהסתיים — הדוח נעול",
      data: null,
      refreshedAt: null,
    };
  }

  if (!isAdminExempt(profile!.role)) {
    const limit = await checkRateLimit(`retention-refresh:${user!.id}`, "general");
    if (limit.rateLimited) {
      return {
        error: "יותר מדי בקשות, נסה שוב בעוד רגע",
        data: null,
        refreshedAt: null,
      };
    }
  }

  try {
    const { data, refreshedAt } = await persistRetentionReport(parsed.data);
    const visible = await callerVisiblePhones();
    if (!(visible instanceof Set) && visible !== null) {
      return { error: visible.error, data: null, refreshedAt: null };
    }
    return { error: null, data: scopeReport(data, visible), refreshedAt };
  } catch (err) {
    console.error("[RetentionRefresh] Failed:", err);
    const message = err instanceof Error ? err.message : "";
    if (/\b429\b/.test(message)) {
      return {
        error: "Arbox מוגבל זמנית, נסה שוב בעוד מספר דקות",
        data: null,
        refreshedAt: null,
      };
    }
    // Surface the real cause to admins so future regressions are diagnosable
    // from the toast itself; non-admins get the generic message.
    const detail = isAdminExempt(profile!.role) && message ? `: ${message}` : "";
    return {
      error: `שגיאה בריענון הדוח${detail}`,
      data: null,
      refreshedAt: null,
    };
  }
}
