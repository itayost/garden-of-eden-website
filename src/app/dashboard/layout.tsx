import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardBottomNav } from "@/components/dashboard/DashboardBottomNav";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DASHBOARD_PAGE_TITLES } from "@/lib/navigation/dashboard-nav";
import { canBookForUser } from "@/features/booking/lib/can-book";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { MotionProvider } from "@/components/MotionProvider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { OnboardingTourProvider } from "@/features/onboarding-tour";
import { SurveyPromptLoader } from "@/features/surveys/components/trainee/SurveyPromptLoader";
import { firstNameOf } from "@/lib/utils/profile";
import type { Profile } from "@/types/database";
import {
  resolveAccessTier,
  type AccessOverride,
} from "@/lib/access/course-access";

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
      "full_name, avatar_url, processed_avatar_url, profile_completed, role, tour_completed, arbox_paid_training, arbox_bought_course, access_override",
    )
    .eq("id", user.id)
    .maybeSingle() as unknown as {
      data:
        | (Profile & {
            arbox_paid_training: boolean;
            arbox_bought_course: boolean;
            access_override: AccessOverride;
          })
        | null;
    };

  if (
    profile &&
    !profile.profile_completed &&
    profile.role !== "admin" &&
    profile.role !== "trainer"
  ) {
    redirect("/onboarding/profile");
  }

  // The middleware is what enforces this; the tier here only decides which nav
  // items are worth showing.
  const tier = resolveAccessTier({
    arboxPaidTraining: profile?.arbox_paid_training ?? false,
    arboxBoughtCourse: profile?.arbox_bought_course ?? false,
    accessOverride: profile?.access_override ?? null,
  });

  // Independent reads; run together so every dashboard render pays for one.
  // The menu shows "קורסים" while any course is published. Locked courses
  // still appear in the list with a lock, so this does not depend on access.
  const [canBook, { data: publishedCourse, error: coursesError }] = await Promise.all([
    profile?.role === "trainee" ? canBookForUser(user.id) : Promise.resolve(false),
    supabase
      .from("courses")
      .select("id")
      .eq("is_published", true)
      .limit(1)
      .maybeSingle(),
  ]);
  if (coursesError) {
    console.error("Dashboard layout published courses read failed:", coursesError);
  }
  const capabilities = { booking: canBook, courses: publishedCourse !== null };
  const firstName = firstNameOf(profile?.full_name ?? null);
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    // MotionConfig(reducedMotion="user") so the workout screen's springs and
    // celebration respect prefers-reduced-motion.
    <MotionProvider>
    <SidebarProvider defaultOpen={sidebarOpen}>
      <DashboardSidebar user={user} profile={profile} tier={tier} capabilities={capabilities} />
      <SidebarInset>
        <AppTopBar
          user={user}
          profile={profile}
          titles={DASHBOARD_PAGE_TITLES}
          fallbackTitle="ראשי"
        />
        <main id="main-content" tabIndex={-1} className="outline-none container mx-auto px-4 pt-6 pb-20 md:pb-8">
          {children}
        </main>
        <DashboardBottomNav tier={tier} capabilities={capabilities} />
      </SidebarInset>
      <Suspense fallback={null}>
        <OnboardingTourProvider
          tourCompleted={profile?.tour_completed ?? true}
        />
      </Suspense>
      <Suspense fallback={null}>
        <SurveyPromptLoader
          userId={user.id}
          tourCompleted={profile?.tour_completed ?? true}
          firstName={firstName}
        />
      </Suspense>
    </SidebarProvider>
    </MotionProvider>
  );
}
