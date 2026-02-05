"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Target,
  FileText,
  Trophy,
  MoreHorizontal,
  Video,
  Utensils,
  Settings,
} from "lucide-react";
import { BottomNav, type BottomNavItem } from "@/components/ui/bottom-nav";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

const mainItems: BottomNavItem[] = [
  { href: "/dashboard", label: "ראשי", icon: Home, exact: true },
  { href: "/dashboard/assessments", label: "מבדקים", icon: Target },
  { href: "/dashboard/forms", label: "שאלונים", icon: FileText },
  { href: "/dashboard/rankings", label: "דירוג", icon: Trophy },
];

const moreItems = [
  { href: "/dashboard/videos", label: "סרטונים", icon: Video },
  { href: "/dashboard/nutrition", label: "תזונה", icon: Utensils },
];

interface DashboardBottomNavProps {
  profile?: Profile | null;
}

export function DashboardBottomNav({ profile }: DashboardBottomNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Check if any "more" item is active
  const moreActive = moreItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
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
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
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
              {(profile?.role === "admin" || profile?.role === "trainer") && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <Settings className="h-5 w-5" />
                  <span className="font-medium">ניהול</span>
                </Link>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      }
    />
  );
}
