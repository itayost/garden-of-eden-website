"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface BottomNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** If true, exact path match is required for active state */
  exact?: boolean;
}

interface BottomNavProps {
  items: BottomNavItem[];
  /** Optional trailing element (e.g. a "More" button) */
  trailing?: React.ReactNode;
  className?: string;
}

export function BottomNav({ items, trailing, className }: BottomNavProps) {
  const pathname = usePathname();

  const isActive = (item: BottomNavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden",
        "bg-background/80 backdrop-blur-lg border-t",
        "pb-safe",
        className
      )}
    >
      <div className="flex items-center justify-around h-16">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", active && "text-primary")} />
              <span className="text-[10px] font-medium leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
        {trailing}
      </div>
    </nav>
  );
}
