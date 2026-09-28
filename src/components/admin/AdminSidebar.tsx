"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { NavBadge } from "@/components/ui/nav-badge";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { isActivePath } from "@/lib/utils/active-path";
import { ADMIN_NAV_SECTIONS } from "@/lib/navigation/admin-nav";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

const ACTIVE_MOBILE_ROW =
  '[data-mobile="true"] [data-sidebar="menu-button"][data-active="true"]';

// Finger-sized rows inside the phone drawer; the desktop rail keeps its density.
const MOBILE_ROW =
  "in-data-[mobile=true]:h-11 in-data-[mobile=true]:gap-3 in-data-[mobile=true]:text-[15px] in-data-[mobile=true]:[&>svg]:size-5";

type AdminSidebarProps = {
  user: User;
  profile: Profile | null;
  /** Attention counts keyed by nav href. Zero or missing renders no badge. */
  navBadges?: Record<string, number>;
};

export function AdminSidebar({ user, profile, navBadges }: AdminSidebarProps) {
  const pathname = usePathname();
  const isAdmin = profile?.role === "admin";
  const { isMobile, openMobile } = useSidebar();

  // The phone drawer is the only navigation on mobile, and trainers mostly
  // move between the operations pages near the end of a long list. Open it on
  // the current page instead of at the top.
  useEffect(() => {
    if (!isMobile || !openMobile) return;
    const frame = requestAnimationFrame(() => {
      // Scroll only the list: scrollIntoView also moves every scrollable
      // ancestor, and iOS Safari scrolls the page behind a fixed sheet.
      const row = document.querySelector<HTMLElement>(ACTIVE_MOBILE_ROW);
      const list = row?.closest<HTMLElement>('[data-sidebar="content"]');
      if (!row || !list) return;
      const rowBox = row.getBoundingClientRect();
      const listBox = list.getBoundingClientRect();
      list.scrollTop +=
        rowBox.top - listBox.top - (list.clientHeight - rowBox.height) / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [isMobile, openMobile]);

  return (
    <AppSidebar
      headerLabel="GARDEN OF EDEN"
      headerBadge={
        <Badge variant="secondary" className="bg-gold text-earth">
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
                        className={MOBILE_ROW}
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
