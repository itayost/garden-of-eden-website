"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LogOut, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

const emptySubscribe = () => () => {};

export type PageTitleResolver = (pathname: string) => string;

type AppTopBarProps = {
  user: User;
  profile: Profile | null;
  titles: Record<string, string>;
  fallbackTitle: string;
};

export function AppTopBar({ user, profile, titles, fallbackTitle }: AppTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const resolveTitle = useMemo(
    () => makeTitleResolver(titles, fallbackTitle),
    [titles, fallbackTitle],
  );

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("התנתקת בהצלחה");
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("ההתנתקות נכשלה, נסו שוב");
    } finally {
      router.push("/");
    }
  };

  const title = resolveTitle(pathname);
  const displayName = profile?.full_name ?? user.phone ?? "משתמש";

  const triggerButton = (
    <Button variant="ghost" className="ms-auto gap-2">
      <UserIcon className="h-5 w-5" />
      <span className="hidden sm:inline">{displayName}</span>
    </Button>
  );

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background px-4">
      <SidebarTrigger />
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      {mounted ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-muted-foreground">
              {user.phone}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive"
            >
              <LogOut className="h-4 w-4" />
              התנתקות
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        triggerButton
      )}
    </header>
  );
}

export function makeTitleResolver(
  titles: Record<string, string>,
  fallback: string,
): PageTitleResolver {
  const sortedKeys = Object.keys(titles).sort((a, b) => b.length - a.length);
  return (pathname: string) => {
    for (const key of sortedKeys) {
      if (pathname === key || pathname.startsWith(`${key}/`)) {
        return titles[key];
      }
    }
    return fallback;
  };
}
