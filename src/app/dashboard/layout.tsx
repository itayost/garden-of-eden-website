import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardBottomNav } from "@/components/dashboard/DashboardBottomNav";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DASHBOARD_PAGE_TITLES } from "@/lib/navigation/dashboard-nav";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { MotionProvider } from "@/components/MotionProvider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { OnboardingTourProvider } from "@/features/onboarding-tour";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, avatar_url, processed_avatar_url, profile_completed, role, tour_completed",
    )
    .eq("id", user.id)
    .maybeSingle() as unknown as { data: Profile | null };

  if (
    profile &&
    !profile.profile_completed &&
    profile.role !== "admin" &&
    profile.role !== "trainer"
  ) {
    redirect("/onboarding/profile");
  }

  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    // MotionConfig(reducedMotion="user") so the workout screen's springs and
    // celebration respect prefers-reduced-motion.
    <MotionProvider>
    <SidebarProvider defaultOpen={sidebarOpen}>
      <DashboardSidebar user={user} profile={profile} />
      <SidebarInset>
        <AppTopBar
          user={user}
          profile={profile}
          titles={DASHBOARD_PAGE_TITLES}
          fallbackTitle="ראשי"
        />
        <main className="container mx-auto px-4 pt-6 pb-20 md:pb-8">
          {children}
        </main>
        <DashboardBottomNav />
      </SidebarInset>
      <Suspense fallback={null}>
        <OnboardingTourProvider
          tourCompleted={profile?.tour_completed ?? true}
        />
      </Suspense>
    </SidebarProvider>
    </MotionProvider>
  );
}
