import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBranchScopeAction } from "@/lib/actions/shared/branch-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { scopedProfileIds, traineePhones } from "@/features/branches/lib/memberships";
import { normalizePhoneIL } from "@/lib/validations/common";
import type { RetentionReportData } from "@/lib/arbox/retention";
import {
  arboxUserIdsForPhone,
  mayWriteRetentionPhone,
  traineesListedUnder,
  type RetentionScope,
  type TraineeIndex,
} from "./visibility";

const OUT_OF_SCOPE = "הלקוח אינו בסניף שלך";
const CHECK_FAILED = "לא ניתן לבדוק את הסניף של הלקוח, נסו שוב";

/**
 * The trainees in the caller's branches, as ids and as phones. Null means no
 * restriction (admins, unassigned trainers). Server-only on purpose: exported
 * from a "use server" file these would be callable from the browser.
 */
export async function callerRetentionScope(): Promise<RetentionScope | null | { error: string }> {
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return { error: scopeResult.error };
  const db = createAdminClient();
  const ids = await scopedProfileIds(db, scopeResult.data.scope);
  if (ids === null) return null;
  return { profileIds: new Set(ids), phones: await traineePhones(db, ids) };
}

/** Who the reports list under a phone, as trainee profile ids (traineesListedUnder). */
export type ListedTrainees = (phone: string) => readonly string[];

/** One month's stored report, or every month's when reportMonth is null. Null on a failed read. */
async function readReports(db: SupabaseClient, reportMonth: string | null): Promise<RetentionReportData[] | null> {
  const query = db.from("retention_reports").select("data");
  const { data, error } = reportMonth === null ? await query : await query.eq("report_month", reportMonth);
  if (error) {
    console.error("[RetentionScope] report read failed:", error.message);
    return null;
  }
  return (data ?? []).map((row) => row.data as unknown as RetentionReportData);
}

/** The trainees behind these phones: by the Arbox ids the reports list them under, and by own phone. */
async function readTraineeIndex(
  db: SupabaseClient,
  reports: readonly RetentionReportData[],
  phones: readonly string[],
): Promise<TraineeIndex | null> {
  const arboxIds = [...new Set(phones.flatMap((phone) => reports.flatMap((r) => arboxUserIdsForPhone(r, phone))))];
  const ownPhones = [
    ...new Set(phones.map((phone) => normalizePhoneIL(phone)).filter((p): p is string => p !== null)),
  ];
  const none = { data: [], error: null };
  const [byArbox, byPhone] = await Promise.all([
    arboxIds.length === 0
      ? none
      : db.from("profiles").select("id, arbox_user_id").in("arbox_user_id", arboxIds).eq("role", "trainee"),
    ownPhones.length === 0
      ? none
      : db
          .from("profiles")
          .select("id, phone")
          .in("phone", ownPhones)
          .eq("role", "trainee")
          .is("deleted_at", null),
  ]);
  const failed = byArbox.error ?? byPhone.error;
  if (failed) {
    console.error("[RetentionScope] profile read failed:", failed.message);
    return null;
  }
  const rows = (data: { id: string; [key: string]: unknown }[] | null) => data ?? [];
  return {
    byArboxId: new Map(rows(byArbox.data).map((p) => [p.arbox_user_id as number, p.id])),
    byPhone: new Map(rows(byPhone.data).map((p) => [p.phone as string, p.id])),
  };
}

/**
 * Resolves the given phones to trainees in one month's report, or across
 * every stored month when reportMonth is null. Null when a read failed:
 * callers then refuse rather than guess.
 */
export async function loadListedTrainees(
  reportMonth: string | null,
  phones: readonly string[],
): Promise<ListedTrainees | null> {
  const db = createAdminClient();
  const reports = await readReports(db, reportMonth);
  if (reports === null) return null;
  const index = await readTraineeIndex(db, reports, phones);
  if (index === null) return null;
  return (phone) => traineesListedUnder(reports, phone, index);
}

async function assertPhoneInScope(traineePhone: string, reportMonth: string | null): Promise<string | null> {
  const scope = await callerRetentionScope();
  if (scope === null) return null;
  if ("error" in scope) return scope.error;
  const listed = await loadListedTrainees(reportMonth, [traineePhone]);
  if (listed === null) return CHECK_FAILED;
  return mayWriteRetentionPhone(traineePhone, listed(traineePhone), scope) ? null : OUT_OF_SCOPE;
}

/**
 * Trainers may annotate or reassign a month's customer, or call them, only
 * inside their branches (mayWriteRetentionPhone), judged on that month's
 * report: notes and trainers are kept per month.
 */
export function assertRetentionPhoneInScope(traineePhone: string, reportMonth: string): Promise<string | null> {
  return assertPhoneInScope(traineePhone, reportMonth);
}

/**
 * The call log is one history per phone across all months, so reading or
 * adding to it is judged on every stored month: a phone ever listed under a
 * trainee outside the caller's branches is refused.
 */
export function assertRetentionPhoneInScopeEveryMonth(traineePhone: string): Promise<string | null> {
  return assertPhoneInScope(traineePhone, null);
}
