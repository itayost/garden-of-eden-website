"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { BottomNav } from "@/components/ui/bottom-nav";
import { NavBadge, NavBadgeDot } from "@/components/ui/nav-badge";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { isActivePath } from "@/lib/utils/active-path";
import { ADMIN_NAV_FLAT } from "@/lib/navigation/admin-nav";
import { splitBottomNav } from "@/lib/navigation/types";

interface AdminBottomNavProps {
  isAdmin?: boolean;
  /** Attention counts keyed by nav href. Zero or missing renders no badge. */
  navBadges?: Record<string, number>;
}

export function AdminBottomNav({
  isAdmin = false,
  navBadges,
}: AdminBottomNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const { main: mainItems, more: visibleMoreItems } = splitBottomNav(
    ADMIN_NAV_FLAT,
    isAdmin
  );

  const moreActive = visibleMoreItems.some((item) =>
    isActivePath(pathname, item.href, item.exact)
  );

  // Items inside the sheet are invisible until it is opened, so the trigger
  // carries a dot when any of them needs attention. Without this an admin on a
  // phone sees a completely unchanged bar while tasks are overdue.
  const moreHasBadge = visibleMoreItems.some(
    (item) => (navBadges?.[item.href] ?? 0) > 0
  );

  return (
    <BottomNav
      items={mainItems}
      badges={navBadges}
      trailing={
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                moreActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-label={moreHasBadge ? "עוד, יש פריטים הדורשים תשומת לב" : "עוד"}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">עוד</span>
              {moreHasBadge && <NavBadgeDot />}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
            <SheetTitle className="sr-only">תפריט נוסף</SheetTitle>
            <nav className="flex flex-col gap-1 pt-2">
              {visibleMoreItems.map((item) => {
                const active = isActivePath(pathname, item.href, item.exact);
                const badgeCount = navBadges?.[item.href] ?? 0;
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
                    <NavBadge count={badgeCount} className="ms-auto" />
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
