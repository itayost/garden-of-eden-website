import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { DashboardBottomNav } from "@/components/dashboard/DashboardBottomNav";
import type { Profile } from "@/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/dashboard");
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single() as { data: Profile | null };

  // Defense-in-depth: Redirect to onboarding if profile is not complete
  if (profile && !profile.profile_completed) {
    redirect("/onboarding/profile");
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardNav user={user} profile={profile} />
      <main className="container mx-auto px-4 pt-8 pb-20 md:pb-8">
        {children}
      </main>
      <DashboardBottomNav profile={profile} />
    </div>
  );
}
