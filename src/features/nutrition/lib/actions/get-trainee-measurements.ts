"use server";

import { verifyUserAccess } from "@/lib/actions/shared/verify-user-access";
import { isValidUUID } from "@/lib/validations/common";
import { typedFrom } from "@/lib/supabase/helpers";
import type { Profile } from "@/types/database";
import type { NutritionMeasurementRow } from "../../types";

/**
 * Get the measurement history for a trainee.
 *
 * Access:
 * - Trainees can read their own history (`body_fat_percentage` masked to null).
 * - Admins and trainers can read any trainee's history with all fields.
 *
 * Returns an empty array on unauthorized access — never throws.
 */
export async function getTraineeMeasurements(
  userId: string
): Promise<NutritionMeasurementRow[]> {
  if (!isValidUUID(userId)) return [];

  const { authorized, supabase } = await verifyUserAccess(userId);
  if (!authorized) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Look up the caller's role to decide whether to mask body_fat_percentage.
  const { data: callerProfile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single()) as { data: Pick<Profile, "role"> | null };

  const callerRole = callerProfile?.role ?? "trainee";

  const { data } = (await typedFrom(supabase, "nutrition_measurements")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("measurement_date", { ascending: false })
    .order("created_at", { ascending: false })) as {
    data: NutritionMeasurementRow[] | null;
  };

  if (!data) return [];

  if (callerRole === "trainee") {
    return data.map((row) => ({ ...row, body_fat_percentage: null }));
  }

  return data;
}
