import {
  BookOpen,
  Calendar,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CreditCard,
  Dumbbell,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Receipt,
  RefreshCw,
  ShieldAlert,
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
      { href: "/admin", label: "דשבורד", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "שחקנים",
    items: [
      { href: "/admin/users", label: "משתמשים", icon: Users },
      { href: "/admin/plans", label: "מסלולים", icon: CreditCard },
      { href: "/admin/assessments", label: "מבדקים", icon: Target },
      { href: "/admin/nutrition", label: "תזונה", icon: Utensils },
      { href: "/admin/submissions", label: "שאלונים", icon: FileText },
    ],
  },
  {
    label: "משחק ואימון",
    items: [
      { href: "/admin/upcoming-games", label: "משחקים קרובים", icon: Calendar },
      { href: "/admin/videos", label: "סרטונים", icon: Video },
      { href: "/admin/book", label: "ספר פיתוח", icon: BookOpen },
      { href: "/admin/course", label: "הקורס הדיגיטלי", icon: GraduationCap },
      { href: "/admin/workouts/exercises", label: "תרגילים ותוכניות", icon: Dumbbell },
    ],
  },
  {
    label: "תפעול",
    items: [
      { href: "/admin/calendar", label: "יומן", icon: CalendarDays },
      { href: "/admin/schedule", label: "בניית אימונים", icon: ClipboardList },
      { href: "/admin/tasks", label: "משימות", icon: ListChecks },
      { href: "/admin/end-of-shift", label: "דוח משמרת", icon: ClipboardCheck },
      { href: "/admin/shifts", label: "שעות עבודה", icon: Clock },
      { href: "/admin/safety", label: "נוהל בטיחות", icon: ShieldAlert },
    ],
  },
  {
    label: "שיווק ולקוחות",
    items: [
      { href: "/admin/leads", label: "לידים", icon: UserPlus },
      { href: "/admin/retention", label: "שימור לקוחות", icon: RefreshCw },
      { href: "/admin/orders", label: "הזמנות", icon: Receipt, adminOnly: true },
    ],
  },
  {
    label: "הגדרות",
    items: [
      { href: "/admin/branches", label: "סניפים", icon: MapPin, adminOnly: true },
    ],
  },
];

export const ADMIN_NAV_FLAT: NavItem[] = ADMIN_NAV_SECTIONS.flatMap((s) => s.items);

export const ADMIN_PAGE_TITLES = derivePageTitles(ADMIN_NAV_FLAT, {
  "/admin/reports/generate": "סיכום שחקן",
  "/admin/plans/products": "קטלוג מסלולים",
});
