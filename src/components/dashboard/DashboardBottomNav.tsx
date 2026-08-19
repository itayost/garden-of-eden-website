"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { isActivePath } from "@/lib/utils/active-path";
import { DASHBOARD_NAV } from "@/lib/navigation/dashboard-nav";
import { filterNavForTier, splitBottomNav } from "@/lib/navigation/types";
import type { AccessTier } from "@/lib/access/course-access";

interface DashboardBottomNavProps {
  tier: AccessTier;
}

export function DashboardBottomNav({ tier }: DashboardBottomNavProps) {
  const { main: mainItems, more: moreItems } = splitBottomNav(
    filterNavForTier(DASHBOARD_NAV, tier),
    true,
  );
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Check if any "more" item is active
  const moreActive = moreItems.some((item) =>
    isActivePath(pathname, item.href, item.exact)
  );

  return (
    <BottomNav
      items={mainItems}
      trailing={
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                moreActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">עוד</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
            <SheetTitle className="sr-only">תפריט נוסף</SheetTitle>
            <nav className="flex flex-col gap-1 pt-2">
              {moreItems.map((item) => {
                const active = isActivePath(pathname, item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
      }
    />
  );
}
