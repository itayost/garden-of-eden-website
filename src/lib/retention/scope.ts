import "server-only";

import { getBranchScopeAction } from "@/lib/actions/shared/branch-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { visibleTraineePhones } from "@/features/branches/lib/memberships";
import { normalizePhoneIL } from "@/lib/validations/common";

/**
 * Retention rows are keyed by Arbox phone, so a trainer's branch scope is a
 * set of phones. Null means no restriction (admins, unassigned trainers).
 * Server-only on purpose: exported from a "use server" file these would be
 * callable from the browser.
 */
export async function callerVisiblePhones(): Promise<Set<string> | null | { error: string }> {
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return { error: scopeResult.error };
  return visibleTraineePhones(createAdminClient(), scopeResult.data.scope);
}

/** Trainers may annotate, reassign or call only customers inside their branches. */
export async function assertPhoneInScope(traineePhone: string): Promise<string | null> {
  const visible = await callerVisiblePhones();
  if (visible instanceof Set || visible === null) {
    if (visible === null) return null;
    const phone = normalizePhoneIL(traineePhone);
    return phone !== null && visible.has(phone) ? null : "הלקוח אינו בסניף שלך";
  }
  return visible.error;
}
