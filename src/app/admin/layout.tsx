import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { getTaskCountsAction } from "@/lib/actions/admin-tasks";
import { getBranchScopeAction } from "@/lib/actions/shared";
import { isBranchManager } from "@/lib/branches/branch-scope";
import { endingSoonBadgeCount } from "@/features/finance/lib/ending-soon-count";
import { ADMIN_PAGE_TITLES } from "@/lib/navigation/admin-nav";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { MotionProvider } from "@/components/MotionProvider";
import type { Profile } from "@/types/database";

async function managesAnyBranch(role: string): Promise<boolean> {
  const scope = await getBranchScopeAction();
  return "success" in scope && isBranchManager(role, scope.data.managedBranchIds);
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, processed_avatar_url, role")
    .eq("id", user.id)
    .maybeSingle() as unknown as { data: Profile | null };

  if (profile?.role !== "admin" && profile?.role !== "trainer") {
    redirect("/dashboard");
  }

  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  const isAdmin = profile?.role === "admin";

  // Task attention count for the nav badge. An admin is nudged by work that
  // needs their judgement (overdue, or closed and unreviewed); a trainer is
  // nudged by their own outstanding work.
  const [countsResult, endingSoon, managesBranch] = await Promise.all([
    getTaskCountsAction(),
    isAdmin ? endingSoonBadgeCount() : Promise.resolve(0),
    // Admins see every item already, so only a Trainer needs the lookup.
    isAdmin ? Promise.resolve(false) : managesAnyBranch(profile?.role ?? ""),
  ]);
  const taskBadge =
    "success" in countsResult
      ? isAdmin
        ? countsResult.data.overdue + countsResult.data.awaitingReview
        : countsResult.data.open
      : 0;
  const navBadges = { "/admin/tasks": taskBadge, "/admin/finance/ending-soon": endingSoon };
  // The header tile stands in for every row while the drawer is shut.
  const menuBadge = Object.values(navBadges).reduce((sum, n) => sum + n, 0);

  return (
    <MotionProvider>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AdminSidebar
          user={user}
          profile={profile}
          navBadges={navBadges}
          managesBranch={managesBranch}
        />
        <SidebarInset>
          <AppTopBar
            user={user}
            profile={profile}
            titles={ADMIN_PAGE_TITLES}
            fallbackTitle="ניהול"
            menuVariant="brand"
            menuBadge={menuBadge}
          />
          <main id="main-content" tabIndex={-1} className="outline-none container mx-auto px-4 pt-6 pb-[max(env(safe-area-inset-bottom),2rem)]">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </MotionProvider>
  );
}
