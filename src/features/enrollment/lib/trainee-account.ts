import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadBranchIdsByProfile, replaceProfileBranches } from "@/features/branches/lib/memberships";
import { phoneVariants } from "@/lib/plans/phone-variants";

/** The profile whose auth phone is this login phone, in any stored spelling. */
export async function findProfileByPhone(db: SupabaseClient, e164: string): Promise<string | null> {
  const { data } = await db
    .from("profiles")
    .select("id")
    .in("phone", phoneVariants(e164))
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * The account on this login phone, created when there is none. The
 * on_auth_user_created trigger makes its profile (phone, role trainee).
 */
export async function findOrCreateAccount(db: SupabaseClient, e164: string, childName: string): Promise<string> {
  const found = await findProfileByPhone(db, e164);
  if (found) return found;
  const { data, error } = await db.auth.admin.createUser({
    phone: e164,
    phone_confirm: true,
    user_metadata: { full_name: childName },
  });
  if (error || !data.user) {
    // A race with a parallel webhook can create the user first; look again.
    const existing = await findProfileByPhone(db, e164);
    if (existing) return existing;
    throw new Error(`auth createUser failed: ${error?.message ?? "no user"}`);
  }
  return data.user.id;
}

/** Adds the branch to the Trainee's memberships, keeping the others. */
export async function ensureBranchMembership(db: SupabaseClient, profileId: string, branchId: string): Promise<void> {
  const memberships = (await loadBranchIdsByProfile(db, [profileId])).get(profileId) ?? [];
  if (memberships.includes(branchId)) return;
  const { error } = await replaceProfileBranches(db, profileId, [...memberships, branchId], { stampAdmin: true });
  if (error) throw new Error(`branch link failed: ${error}`);
}

/**
 * A new trainee registered by staff before paying (a Payment link): the
 * account, the child's name and the parent, and the branch, so the child is
 * on the users list and can be put on a roster at once. Values already on
 * the profile win. The Plan comes only when the card is charged.
 */
export async function openTraineeAccount(
  db: SupabaseClient,
  input: { loginPhone: string; childName: string; parent: { name: string; phone: string }; branchId: string },
): Promise<string> {
  const profileId = await findOrCreateAccount(db, input.loginPhone, input.childName);
  const { data: profile } = await db
    .from("profiles")
    .select("full_name, guardian_name, guardian_phone")
    .eq("id", profileId)
    .single();
  const { error } = await db
    .from("profiles")
    .update({
      full_name: profile?.full_name || input.childName,
      guardian_name: profile?.guardian_name ?? input.parent.name,
      guardian_phone: profile?.guardian_phone ?? input.parent.phone,
    })
    .eq("id", profileId);
  if (error) throw new Error(`profile update failed: ${error.message}`);
  await ensureBranchMembership(db, profileId, input.branchId);
  return profileId;
}
