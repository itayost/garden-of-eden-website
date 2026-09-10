import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import { isInBranchScope, type BranchScope } from "@/lib/branches/branch-scope";
import type { Branch, BranchOption } from "@/types/branches";
import { toBranchOption } from "@/types/branches";

/**
 * Membership reads and writes that need the service role.
 *
 * profile_branches lets a user read only their own rows, so any staff surface
 * that needs another user's branches comes through here with an admin client.
 * Every caller must already be gated by verifyAdmin / verifyAdminOrTrainer;
 * this module trusts the client it is handed and checks nothing itself.
 */

export const OUT_OF_SCOPE_TRAINEE_ERROR = "המתאמן אינו בסניף שלך";

interface MembershipRow {
  profile_id: string;
  branch_id: string;
}

export async function loadBranchIdsByProfile(
  db: SupabaseClient,
  profileIds: readonly string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (profileIds.length === 0) return result;

  const { data, error } = (await typedFrom(db, "profile_branches")
    .select("profile_id, branch_id")
    .in("profile_id", [...profileIds])) as {
    data: MembershipRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("loadBranchIdsByProfile error:", error);
    return result;
  }

  for (const row of data ?? []) {
    const existing = result.get(row.profile_id) ?? [];
    result.set(row.profile_id, [...existing, row.branch_id]);
  }
  return result;
}

/** Profile ids that belong to at least one of the given branches. */
export async function listProfileIdsInBranches(
  db: SupabaseClient,
  branchIds: readonly string[],
): Promise<string[]> {
  if (branchIds.length === 0) return [];

  const { data, error } = (await typedFrom(db, "profile_branches")
    .select("profile_id")
    .in("branch_id", [...branchIds])) as {
    data: { profile_id: string }[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("listProfileIdsInBranches error:", error);
    return [];
  }

  return Array.from(new Set((data ?? []).map((row) => row.profile_id)));
}

/**
 * The profile ids a scope may see, or null for no restriction.
 * An empty array is a real answer: the scope's branches have no members.
 */
export async function scopedProfileIds(
  db: SupabaseClient,
  scope: BranchScope,
): Promise<string[] | null> {
  if (scope.kind === "all") return null;
  return listProfileIdsInBranches(db, scope.ids);
}

/**
 * The profile ids a list may show: the caller's scope, intersected with an
 * optional admin-picked branch. Null means no restriction at all.
 */
export async function visibleProfileIds(
  db: SupabaseClient,
  scope: BranchScope,
  filterBranchId: string | undefined,
): Promise<string[] | null> {
  const scoped = await scopedProfileIds(db, scope);
  if (!filterBranchId) return scoped;

  const members = await listProfileIdsInBranches(db, [filterBranchId]);
  if (scoped === null) return members;
  return scoped.filter((id) => members.includes(id));
}

/** True when the caller's scope covers this trainee. */
export async function isTraineeInScope(
  db: SupabaseClient,
  scope: BranchScope,
  traineeId: string,
): Promise<boolean> {
  if (scope.kind === "all") return true;
  const memberships = await loadBranchIdsByProfile(db, [traineeId]);
  return isInBranchScope(scope, memberships.get(traineeId) ?? []);
}

/**
 * Replaces a user's memberships wholesale. Delete then insert: the form always
 * submits the complete list and a membership row carries no state of its own.
 * stampAdmin marks the profile as hand-edited so the Arbox sync leaves it alone.
 */
export async function replaceProfileBranches(
  db: SupabaseClient,
  profileId: string,
  branchIds: readonly string[],
  options: { stampAdmin: boolean },
): Promise<{ error: string | null }> {
  const { error: deleteError } = await typedFrom(db, "profile_branches")
    .delete()
    .eq("profile_id", profileId);

  if (deleteError) {
    console.error("replaceProfileBranches delete error:", deleteError);
    return { error: "שגיאה בעדכון הסניפים" };
  }

  if (branchIds.length > 0) {
    const { error: insertError } = await typedFrom(db, "profile_branches").insert(
      branchIds.map((branchId) => ({ profile_id: profileId, branch_id: branchId })),
    );
    if (insertError) {
      console.error("replaceProfileBranches insert error:", insertError);
      return { error: "שגיאה בעדכון הסניפים" };
    }
  }

  if (options.stampAdmin) {
    const { error: stampError } = await db
      .from("profiles")
      .update({ branches_set_by_admin_at: new Date().toISOString() })
      .eq("id", profileId);
    if (stampError) {
      console.error("replaceProfileBranches stamp error:", stampError);
      return { error: "שגיאה בעדכון הסניפים" };
    }
  }

  return { error: null };
}

/** Active branches in display order, as picker options. */
export async function loadBranchOptions(db: SupabaseClient): Promise<BranchOption[]> {
  const { data, error } = (await typedFrom(db, "branches")
    .select("*")
    .eq("is_active", true)
    .order("order_index")) as { data: Branch[] | null; error: { message: string } | null };

  if (error) {
    console.error("loadBranchOptions error:", error);
    return [];
  }
  return (data ?? []).map(toBranchOption);
}

/** Every branch, active or not, in display order. */
export async function loadAllBranches(db: SupabaseClient): Promise<Branch[]> {
  const { data, error } = (await typedFrom(db, "branches")
    .select("*")
    .order("order_index")) as { data: Branch[] | null; error: { message: string } | null };

  if (error) {
    console.error("loadAllBranches error:", error);
    return [];
  }
  return data ?? [];
}

/** Active branches one user belongs to, in display order. */
export async function loadMemberBranchOptions(
  db: SupabaseClient,
  profileId: string,
): Promise<BranchOption[]> {
  const [options, memberships] = await Promise.all([
    loadBranchOptions(db),
    loadBranchIdsByProfile(db, [profileId]),
  ]);
  const ids = memberships.get(profileId) ?? [];
  return options.filter((option) => ids.includes(option.id));
}

/** Resolves ids to Hebrew names in the order given; unknown ids are dropped. */
export function branchNamesFor(
  branchIds: readonly string[],
  branches: readonly BranchOption[],
): string[] {
  const byId = new Map(branches.map((b) => [b.id, b.nameHe]));
  return branchIds.flatMap((id) => {
    const name = byId.get(id);
    return name ? [name] : [];
  });
}
