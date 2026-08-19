"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { isActivePath } from "@/lib/utils/active-path";
import { DASHBOARD_NAV } from "@/lib/navigation/dashboard-nav";
import { filterNavForTier } from "@/lib/navigation/types";
import type { AccessTier } from "@/lib/access/course-access";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

type DashboardSidebarProps = {
  user: User;
  profile: Profile | null;
  /** Decides which nav items this trainee is shown. */
  tier: AccessTier;
};

export function DashboardSidebar({
  user,
  profile,
  tier,
}: DashboardSidebarProps) {
  const navItems = filterNavForTier(DASHBOARD_NAV, tier);
  const pathname = usePathname();
  return (
    <AppSidebar
      headerLabel="GARDEN OF EDEN"
      user={user}
      profile={profile}
    >
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href, item.exact);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={item.label}
                  >
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </AppSidebar>
  );
}
