import {
  BookOpen,
  Calendar,
  ClipboardCheck,
  Clock,
  Dumbbell,
  FileText,
  LayoutDashboard,
  RefreshCw,
  Target,
  Users,
  UserPlus,
  Utensils,
  Video,
} from "lucide-react";
import { derivePageTitles, type NavItem, type NavSection } from "@/lib/navigation/types";

export const ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    label: "ראשי",
    items: [
      { href: "/admin", label: "דשבורד", icon: LayoutDashboard, exact: true, mobilePrimary: true },
    ],
  },
  {
    label: "שחקנים",
    items: [
      { href: "/admin/users", label: "משתמשים", icon: Users, mobilePrimary: true },
      { href: "/admin/assessments", label: "מבדקים", icon: Target, mobilePrimary: true },
      { href: "/admin/nutrition", label: "תזונה", icon: Utensils },
      { href: "/admin/submissions", label: "שאלונים", icon: FileText, mobilePrimary: true },
    ],
  },
  {
    label: "משחק ואימון",
    items: [
      { href: "/admin/upcoming-games", label: "משחקים קרובים", icon: Calendar },
      { href: "/admin/videos", label: "סרטונים", icon: Video },
      { href: "/admin/book", label: "ספר פיתוח", icon: BookOpen },
      { href: "/admin/workouts/exercises", label: "תרגילים ותוכניות", icon: Dumbbell },
    ],
  },
  {
    label: "תפעול",
    items: [
      { href: "/admin/end-of-shift", label: "דוח משמרת", icon: ClipboardCheck },
      { href: "/admin/shifts", label: "שעות עבודה", icon: Clock },
    ],
  },
  {
    label: "שיווק ולקוחות",
    items: [
      { href: "/admin/leads", label: "לידים", icon: UserPlus },
      { href: "/admin/retention", label: "שימור לקוחות", icon: RefreshCw },
    ],
  },
];

export const ADMIN_NAV_FLAT: NavItem[] = ADMIN_NAV_SECTIONS.flatMap((s) => s.items);

export const ADMIN_PAGE_TITLES = derivePageTitles(ADMIN_NAV_FLAT, {
  "/admin/reports/generate": "סיכום שחקן",
});
