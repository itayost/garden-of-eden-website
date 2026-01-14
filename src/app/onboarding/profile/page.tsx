import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileCompletionForm } from "@/components/onboarding/ProfileCompletionForm";
import type { Profile } from "@/types/database";

export default async function OnboardingProfilePage() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/onboarding/profile");
  }

  // Get existing profile data
  const { data: profile } = (await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  // If profile is already complete, redirect to dashboard
  if (profile?.profile_completed) {
    redirect("/dashboard");
  }

  return (
    <div className="py-8">
      <ProfileCompletionForm
        userId={user.id}
        initialData={{
          full_name: profile?.full_name,
          birthdate: profile?.birthdate,
          position: profile?.position,
          avatar_url: profile?.avatar_url,
        }}
      />
    </div>
  );
}
