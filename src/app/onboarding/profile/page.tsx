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
    .maybeSingle()) as { data: Profile | null };

  // Admins/trainers don't need onboarding
  if (profile?.role === "admin" || profile?.role === "trainer") {
    redirect("/admin");
  }

  // If profile is already complete, go to dashboard
  if (profile?.profile_completed) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0A1F0A] to-[#142814] p-4">
      <ProfileCompletionForm
        userId={user.id}
        fullName={profile?.full_name || ""}
        initialData={{
          birthdate: profile?.birthdate,
          position: profile?.position,
        }}
      />
    </div>
  );
}
