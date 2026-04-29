import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { Profile } from "@/types/database";

type AppSidebarProps = {
  headerLabel: string;
  headerBadge?: ReactNode;
  user: User;
  profile: Profile | null;
  children: ReactNode;
};

export function AppSidebar({
  headerLabel,
  headerBadge,
  user,
  profile,
  children,
}: AppSidebarProps) {
  const displayName = profile?.full_name ?? user.phone ?? "משתמש";
  const initial = (displayName.trim()[0] ?? "?").toUpperCase();

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span
            aria-hidden="true"
            className="h-6 w-6 rounded-md bg-sidebar-primary"
          />
          <span className="font-black tracking-wide text-sidebar-foreground">
            {headerLabel}
          </span>
          {headerBadge}
        </div>
      </SidebarHeader>

      <SidebarContent>{children}</SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold"
          >
            {initial}
          </span>
          <span className="truncate text-sm text-sidebar-foreground">
            {displayName}
          </span>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
