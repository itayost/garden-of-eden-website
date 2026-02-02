"use server";

import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

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
 * @example
 * ```ts
 * const { error, user, adminProfile } = await verifyAdmin();
 * if (error) return { error };
 * // user and adminProfile are now guaranteed to exist
 * ```
 */
export async function verifyAdmin(): Promise<AdminVerifyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "לא מחובר", user: null, adminProfile: null };
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== "admin") {
    return { error: "נדרשת הרשאת מנהל", user: null, adminProfile: null };
  }

  return {
    error: null,
    user,
    adminProfile: adminProfile as { role: string; full_name: string | null },
  };
}

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
 * @returns TrainerVerifyResult with either user data or error
 */
export async function verifyAdminOrTrainer(): Promise<TrainerVerifyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "לא מחובר", user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "trainer") {
    return { error: "נדרשת הרשאת מנהל או מאמן", user: null, profile: null };
  }

  return {
    error: null,
    user,
    profile: profile as { role: string; full_name: string | null },
  };
}
