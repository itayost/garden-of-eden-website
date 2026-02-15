"use server";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

/**
 * Result of user access verification.
 * On success, returns the authenticated supabase client for reuse.
 */
export type UserAccessResult =
  | { authorized: true; supabase: SupabaseClient }
  | { authorized: false; supabase: SupabaseClient };

/**
 * Verify the current user has access to the given userId's data.
 *
 * - If the caller IS the target user, access is granted (self-access).
 * - If the caller is NOT the target user, access is granted only if
 *   the caller has "trainer" or "admin" role.
 * - If the caller is not authenticated, access is denied.
 *
 * Returns the supabase client so callers can reuse it for subsequent queries
 * without creating a second client instance.
 *
 * @example
 * ```ts
 * const { authorized, supabase } = await verifyUserAccess(userId);
 * if (!authorized) return [];
 * // proceed with supabase queries
 * ```
 */
export async function verifyUserAccess(
  userId: string
): Promise<UserAccessResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false, supabase };
  }

  // Self-access is always allowed
  if (user.id === userId) {
    return { authorized: true, supabase };
  }

  // For cross-user access, verify caller is trainer or admin
  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single()) as { data: Pick<Profile, "role"> | null };

  if (!profile || !["trainer", "admin"].includes(profile.role)) {
    return { authorized: false, supabase };
  }

  return { authorized: true, supabase };
}
