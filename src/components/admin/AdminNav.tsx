"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Users,
  FileText,
  Video,
  User as UserIcon,
  LogOut,
  Target,
  Utensils,
  ClipboardCheck,
  Clock,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

const navItems = [
  { href: "/admin", label: "דשבורד", icon: LayoutDashboard, adminOnly: false },
  { href: "/admin/users", label: "משתמשים", icon: Users, adminOnly: false },
  { href: "/admin/assessments", label: "מבדקים", icon: Target, adminOnly: false },
  { href: "/admin/nutrition", label: "תזונה", icon: Utensils, adminOnly: false },
  { href: "/admin/submissions", label: "שאלונים", icon: FileText, adminOnly: false },
  { href: "/admin/end-of-shift", label: "דוח משמרת", icon: ClipboardCheck, adminOnly: false },
  { href: "/admin/shifts", label: "שעות עבודה", icon: Clock, adminOnly: false },
  { href: "/admin/leads", label: "לידים", icon: UserPlus, adminOnly: false },
  { href: "/admin/videos", label: "סרטונים", icon: Video, adminOnly: true },
];

interface AdminNavProps {
  user: User;
  profile: Profile | null;
}

export function AdminNav({ user, profile }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("התנתקת בהצלחה");
    router.push("/");
  };

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  const isAdmin = profile?.role === "admin";

  const visibleNavItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <header className="sticky top-0 z-50 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-xl font-black">
              GARDEN OF EDEN
            </Link>
            <Badge variant="secondary" className="bg-sidebar-accent text-sidebar-accent-foreground">
              ניהול
            </Badge>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-2">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive(item.href)
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                  <UserIcon className="h-5 w-5" />
                  <span className="hidden sm:inline">
                    {profile?.full_name || user.phone || "מנהל"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-muted-foreground">
                  {profile?.role === "admin" ? "מנהל" : "מאמן"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="ml-2 h-4 w-4" />
                  התנתקות
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
