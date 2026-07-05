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
import { AppSidebar } from "@/components/layout/AppSidebar";
import { isActivePath } from "@/lib/utils/active-path";
import {
  BookOpen,
  Calendar,
  ClipboardCheck,
  Clock,
  Dumbbell,
  FileText,
  LayoutDashboard,
  RefreshCw,
  Target,
  Users,
  UserPlus,
  Utensils,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  exact?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "ראשי",
    items: [{ href: "/admin", label: "דשבורד", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "שחקנים",
    items: [
      { href: "/admin/users", label: "משתמשים", icon: Users },
      { href: "/admin/assessments", label: "מבדקים", icon: Target },
      { href: "/admin/nutrition", label: "תזונה", icon: Utensils },
      { href: "/admin/submissions", label: "שאלונים", icon: FileText },
    ],
  },
  {
    label: "משחק ואימון",
    items: [
      { href: "/admin/upcoming-games", label: "משחקים קרובים", icon: Calendar },
      { href: "/admin/videos", label: "סרטונים", icon: Video },
      { href: "/admin/book", label: "ספר פיתוח", icon: BookOpen },
      { href: "/admin/workouts/exercises", label: "תרגילים ותוכניות", icon: Dumbbell },
    ],
  },
  {
    label: "תפעול",
    items: [
      { href: "/admin/end-of-shift", label: "דוח משמרת", icon: ClipboardCheck },
      { href: "/admin/shifts", label: "שעות עבודה", icon: Clock },
    ],
  },
  {
    label: "שיווק ולקוחות",
    items: [
      { href: "/admin/leads", label: "לידים", icon: UserPlus },
      { href: "/admin/retention", label: "שימור לקוחות", icon: RefreshCw },
    ],
  },
];

export const PAGE_TITLES: Record<string, string> = {
  ...Object.fromEntries(
    NAV_SECTIONS.flatMap((s) => s.items).map((item) => [item.href, item.label]),
  ),
  "/admin/reports/generate": "סיכום שחקן",
};

type AdminSidebarProps = {
  user: User;
  profile: Profile | null;
};

export function AdminSidebar({ user, profile }: AdminSidebarProps) {
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
      {NAV_SECTIONS.map((section) => {
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
        );
      })}
    </AppSidebar>
  );
}
