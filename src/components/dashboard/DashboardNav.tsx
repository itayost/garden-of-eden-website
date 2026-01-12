"use client";

import { useState, useEffect } from "react";
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Home,
  FileText,
  Video,
  User as UserIcon,
  LogOut,
  Menu,
  Settings,
  Target
} from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

const navItems = [
  { href: "/dashboard", label: "ראשי", icon: Home },
  { href: "/dashboard/assessments", label: "מבדקים", icon: Target },
  { href: "/dashboard/forms", label: "שאלונים", icon: FileText },
  { href: "/dashboard/videos", label: "סרטונים", icon: Video },
];

interface DashboardNavProps {
  user: User;
  profile: Profile | null;
}

export function DashboardNav({ user, profile }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch with Radix UI components
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("התנתקת בהצלחה");
    router.push("/");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  const NavLinks = () => (
    <>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            isActive(item.href)
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          }`}
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </Link>
      ))}
      {(profile?.role === "admin" || profile?.role === "trainer") && (
        <Link
          href="/admin"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            pathname.startsWith("/admin")
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          }`}
        >
          <Settings className="h-5 w-5" />
          ניהול
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 bg-background border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="text-xl font-black text-primary">
            GARDEN OF EDEN
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-2">
            <NavLinks />
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <UserIcon className="h-5 w-5" />
                    <span className="hidden sm:inline">
                      {profile?.full_name || user.phone || "משתמש"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-muted-foreground">
                    {user.phone}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="ml-2 h-4 w-4" />
                    התנתקות
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" className="gap-2">
                <UserIcon className="h-5 w-5" />
                <span className="hidden sm:inline">
                  {profile?.full_name || user.phone || "משתמש"}
                </span>
              </Button>
            )}

            {/* Mobile Menu */}
            {mounted ? (
              <Sheet>
                <SheetTrigger asChild className="md:hidden">
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64">
                  <nav className="flex flex-col gap-2 mt-8">
                    <NavLinks />
                  </nav>
                </SheetContent>
              </Sheet>
            ) : (
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
