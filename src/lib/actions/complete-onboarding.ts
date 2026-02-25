"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { onboardingSchema } from "@/lib/validations/profile";

export async function completeOnboardingAction(data: {
  full_name: string;
  birthdate: string;
  position?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "לא מחובר" };

  // Validate input server-side
  const parsed = onboardingSchema.safeParse(data);
  if (!parsed.success) return { error: "נתונים לא תקינים" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      birthdate: parsed.data.birthdate,
      position: parsed.data.position || null,
      profile_completed: true,
    })
    .eq("id", user.id);

  if (error) return { error: "שגיאה בשמירת הפרופיל" };
  return { success: true };
}
