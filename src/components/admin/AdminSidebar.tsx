"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { NavBadge } from "@/components/ui/nav-badge";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { isActivePath } from "@/lib/utils/active-path";
import { ADMIN_NAV_SECTIONS } from "@/lib/navigation/admin-nav";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

type AdminSidebarProps = {
  user: User;
  profile: Profile | null;
  /** Attention counts keyed by nav href. Zero or missing renders no badge. */
  navBadges?: Record<string, number>;
};

export function AdminSidebar({ user, profile, navBadges }: AdminSidebarProps) {
  const pathname = usePathname();
  const isAdmin = profile?.role === "admin";

  return (
    <AppSidebar
      headerLabel="GARDEN OF EDEN"
      headerBadge={
        <Badge
          variant="secondary"
          className="ms-auto bg-gold text-earth group-data-[collapsible=icon]:hidden"
        >
          ניהול
        </Badge>
      }
      user={user}
      profile={profile}
    >
      {ADMIN_NAV_SECTIONS.map((section) => {
        const visibleItems = section.items.filter(
          (item) => !item.adminOnly || isAdmin,
        );
        if (visibleItems.length === 0) return null;
        return (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map((item) => {
                  const active = isActivePath(pathname, item.href, item.exact);
                  const badgeCount = navBadges?.[item.href] ?? 0;
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
                          <NavBadge
                            count={badgeCount}
                            className="ms-auto group-data-[collapsible=icon]:hidden"
                          />
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </AppSidebar>
  );
}
