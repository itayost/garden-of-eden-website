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
import {
  FileText,
  Home,
  Target,
  Trophy,
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
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "ראשי", icon: Home },
  { href: "/dashboard/assessments", label: "מבדקים", icon: Target },
  { href: "/dashboard/rankings", label: "דירוג", icon: Trophy },
  { href: "/dashboard/forms", label: "שאלונים", icon: FileText },
  { href: "/dashboard/nutrition", label: "תזונה", icon: Utensils },
  { href: "/dashboard/videos", label: "סרטונים", icon: Video },
];

export const PAGE_TITLES: Record<string, string> = NAV_ITEMS.reduce<
  Record<string, string>
>((acc, item) => {
  acc[item.href] = item.label;
  return acc;
}, {});

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type DashboardSidebarProps = {
  user: User;
  profile: Profile | null;
};

export function DashboardSidebar({ user, profile }: DashboardSidebarProps) {
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
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
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
