"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface WorkoutsTab {
  label: string;
  href: string;
  isActive: (pathname: string) => boolean;
}

const TABS: WorkoutsTab[] = [
  {
    label: "תרגילים",
    href: "/admin/workouts/exercises",
    isActive: (pathname) => pathname.startsWith("/admin/workouts/exercises"),
  },
  {
    label: "תוכניות",
    href: "/admin/workouts/programs",
    isActive: (pathname) => pathname.startsWith("/admin/workouts/programs"),
  },
];

export default function WorkoutsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <nav
        className="flex items-center gap-6 border-b"
        role="tablist"
        aria-label="ניהול אימונים"
      >
        {TABS.map((tab) => {
          const active = tab.isActive(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={active}
              className={cn(
                "-mb-px border-b-2 pb-3 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
