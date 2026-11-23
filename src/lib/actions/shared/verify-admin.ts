"use server";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { getCurrentProfile, getCurrentUser } from "@/lib/supabase/current-user";

/**
 * Admin verification result
 */
export type AdminVerifyResult =
  | {
      error: null;
      user: User;
      adminProfile: { role: string; full_name: string | null };
    }
  | {
      error: string;
      user: null;
      adminProfile: null;
    };

/**
 * Verify current user is authenticated and has admin role.
 * Centralized admin verification for all admin server actions.
 *
 * @returns AdminVerifyResult with either user data or error
 *
 * Memoized per request with React `cache()`: a single page render calls this
 * from the layout, the page and every server action it fans out to, which
 * otherwise costs an `auth.getUser()` round trip plus a profiles SELECT each
 * time. The user and the profile row come from `getCurrentUser()` and
 * `getCurrentProfile()`, which the layouts share too. The cache is
 * request-scoped, so it can never serve one user's identity to another.
 *
 * @example
 * ```ts
 * const { error, user, adminProfile } = await verifyAdmin();
 * if (error) return { error };
 * // user and adminProfile are now guaranteed to exist
 * ```
 */
export const verifyAdmin = cache(async (): Promise<AdminVerifyResult> => {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "לא מחובר", user: null, adminProfile: null };
  }

  const profile = await getCurrentProfile();

  if (profile?.deleted_at != null || profile?.role !== "admin") {
    return { error: "נדרשת הרשאת מנהל", user: null, adminProfile: null };
  }

  return {
    error: null,
    user,
    adminProfile: { role: profile.role, full_name: profile.full_name },
  };
});

/**
 * Trainer verification result (admin or trainer role)
 */
export type TrainerVerifyResult =
  | {
      error: null;
      user: User;
      profile: { role: string; full_name: string | null };
    }
  | {
      error: string;
      user: null;
      profile: null;
    };

/**
 * Verify current user is authenticated and has admin or trainer role.
 * Used for actions that both admins and trainers can perform.
 *
 * Memoized per request, for the same reason as verifyAdmin above.
 *
 * @returns TrainerVerifyResult with either user data or error
 */
export const verifyAdminOrTrainer = cache(async (): Promise<TrainerVerifyResult> => {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "לא מחובר", user: null, profile: null };
  }

  const profile = await getCurrentProfile();

  if (
    !profile ||
    profile.deleted_at != null ||
    (profile.role !== "admin" && profile.role !== "trainer")
  ) {
    return { error: "נדרשת הרשאת מנהל או מאמן", user: null, profile: null };
  }

  return {
    error: null,
    user,
    profile: { role: profile.role, full_name: profile.full_name },
  };
});
