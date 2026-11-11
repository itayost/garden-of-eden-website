import "server-only";

import { getBranchScopeAction } from "@/lib/actions/shared/branch-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { profilePhones, scopedProfileIds } from "@/features/branches/lib/memberships";
import type { RetentionReportData } from "@/lib/arbox/retention";
import { arboxUserIdsForPhone, mayWriteRetentionPhone, type RetentionScope } from "./visibility";

const OUT_OF_SCOPE = "הלקוח אינו בסניף שלך";

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
  return { profileIds: new Set(ids), phones: await profilePhones(db, ids) };
}

/** Who a month's report lists under a phone, as trainee profile ids. */
export type ListedTrainees = (phone: string) => readonly string[];

const NOBODY: ListedTrainees = () => [];

/**
 * Reads the month's report once and resolves its Arbox ids to trainees, so
 * any phone can then be checked: Arbox may list a phone that is not the
 * profile's. A failed read lists nobody, which leaves only a trainee's own
 * phone in scope to pass.
 */
export async function loadListedTrainees(reportMonth: string): Promise<ListedTrainees> {
  const db = createAdminClient();
  const { data: row, error } = await db
    .from("retention_reports")
    .select("data")
    .eq("report_month", reportMonth)
    .maybeSingle();
  if (error) {
    console.error("[RetentionScope] report read failed:", error.message);
    return NOBODY;
  }
  if (!row) return NOBODY;

  const report = row.data as unknown as RetentionReportData;
  const entries = [...(report.monthly ?? []), ...(report.pro ?? []), ...(report.training_card ?? [])];
  const arboxIds = [...new Set(entries.flatMap((e) => (e.user_id !== null ? [e.user_id] : [])))];
  if (arboxIds.length === 0) return NOBODY;

  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id, arbox_user_id")
    .in("arbox_user_id", arboxIds)
    .eq("role", "trainee");
  if (profileError) {
    console.error("[RetentionScope] profile read failed:", profileError.message);
    return NOBODY;
  }
  const traineeByArboxId = new Map((profiles ?? []).map((p) => [p.arbox_user_id, p.id]));
  return (phone) => arboxUserIdsForPhone(report, phone).flatMap((id) => traineeByArboxId.get(id) ?? []);
}

/**
 * Trainers may annotate, reassign or call only customers inside their
 * branches (mayWriteRetentionPhone). If the report or profiles cannot be read,
 * nobody counts as listed and only a trainee's own phone in scope passes.
 */
export async function assertRetentionPhoneInScope(
  traineePhone: string,
  reportMonth: string,
): Promise<string | null> {
  const scope = await callerRetentionScope();
  if (scope === null) return null;
  if ("error" in scope) return scope.error;
  const listed = await loadListedTrainees(reportMonth);
  return mayWriteRetentionPhone(traineePhone, listed(traineePhone), scope) ? null : OUT_OF_SCOPE;
}
