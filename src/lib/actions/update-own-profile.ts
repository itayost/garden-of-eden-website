"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { profileSelfUpdateSchema } from "@/lib/validations/profile";

/**
 * Let a signed-in user edit their OWN birthdate + position.
 *
 * Scoped to the caller's own profile id (never role/is_active). Uses the admin
 * client because there is no self-update RLS policy on profiles for non-admins
 * (same pattern as completeOnboardingAction).
 *
 * Note: birthdate is intentionally free to edit. The Arbox nightly sync only
 * fills NULL birthdates (`.is("birthdate", null)`), so a user-set value is never
 * overwritten. Changing birthdate re-computes the player's age group via DB
 * trigger — which is the desired behavior.
 */
export async function updateOwnProfileAction(data: {
  birthdate: string;
  position?: string | null;
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "לא מחובר" };

  const parsed = profileSelfUpdateSchema.safeParse(data);
  if (!parsed.success) return { error: "נתונים לא תקינים" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      birthdate: parsed.data.birthdate,
      position: parsed.data.position || null,
    })
    .eq("id", user.id);

  if (error) {
    console.error("Update own profile failed:", error);
    return { error: "שגיאה בשמירת הפרופיל" };
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
  return { success: true };
}
