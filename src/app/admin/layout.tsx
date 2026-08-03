import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { getTaskCountsAction } from "@/lib/actions/admin-tasks";
import { ADMIN_PAGE_TITLES } from "@/lib/navigation/admin-nav";
import { AdminBottomNav } from "@/components/admin/AdminBottomNav";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { Profile } from "@/types/database";

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
  const countsResult = await getTaskCountsAction();
  const taskBadge =
    "success" in countsResult
      ? isAdmin
        ? countsResult.data.overdue + countsResult.data.awaitingReview
        : countsResult.data.open
      : 0;
  const navBadges = { "/admin/tasks": taskBadge };

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AdminSidebar user={user} profile={profile} navBadges={navBadges} />
      <SidebarInset>
        <AppTopBar
          user={user}
          profile={profile}
          titles={ADMIN_PAGE_TITLES}
          fallbackTitle="ניהול"
        />
        <main className="container mx-auto px-4 pt-6 pb-20 md:pb-8">
          {children}
        </main>
        <AdminBottomNav isAdmin={isAdmin} navBadges={navBadges} />
      </SidebarInset>
    </SidebarProvider>
  );
}
