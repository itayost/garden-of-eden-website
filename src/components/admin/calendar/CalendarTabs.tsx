"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CalendarRange } from "lucide-react";

import { useCurrentBranch } from "@/features/branches/components/BranchContext";
import { cn } from "@/lib/utils";
import {
  CALENDAR_LABEL,
  CALENDAR_PATH,
  CALENDAR_TEMPLATE_LABEL,
  CALENDAR_TEMPLATE_PATH,
} from "@/lib/navigation/calendar-views";

const TABS = [
  { href: CALENDAR_PATH, label: CALENDAR_LABEL, Icon: CalendarDays },
  { href: CALENDAR_TEMPLATE_PATH, label: CALENDAR_TEMPLATE_LABEL, Icon: CalendarRange },
] as const;

/**
 * The two faces of one calendar: the dated days staff work in, and the standing
 * week those days are seeded from. Separate routes rather than in-page tabs, so
 * each loads only its own data and either can be linked to; the branch carries
 * across.
 */
export function CalendarTabs() {
  const pathname = usePathname();
  const { branchId } = useCurrentBranch();

  return (
    <nav aria-label="תצוגות היומן" className="flex w-full gap-1 rounded-xl bg-muted p-1 sm:w-fit">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={`${href}?branch=${branchId}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-center text-sm leading-tight transition-colors pointer-coarse:min-h-11 sm:flex-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-background font-medium text-forest shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
