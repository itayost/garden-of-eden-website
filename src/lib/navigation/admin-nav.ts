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
  // sidebar order = section/array order; mobile bar/sheet order = mobileOrder.
  {
    label: "ראשי",
    items: [
      { href: "/admin", label: "דשבורד", icon: LayoutDashboard, exact: true, mobilePrimary: true, mobileOrder: 1 },
    ],
  },
  {
    label: "שחקנים",
    items: [
      { href: "/admin/users", label: "משתמשים", icon: Users, mobilePrimary: true, mobileOrder: 2 },
      { href: "/admin/plans", label: "מסלולים", icon: CreditCard, mobileOrder: 6 },
      { href: "/admin/assessments", label: "מבדקים", icon: Target, mobilePrimary: true, mobileOrder: 3 },
      { href: "/admin/nutrition", label: "תזונה", icon: Utensils, mobileOrder: 5 },
      { href: "/admin/submissions", label: "שאלונים", icon: FileText, mobilePrimary: true, mobileOrder: 4 },
    ],
  },
  {
    label: "משחק ואימון",
    items: [
      { href: "/admin/upcoming-games", label: "משחקים קרובים", icon: Calendar, mobileOrder: 2 },
      { href: "/admin/videos", label: "סרטונים", icon: Video, mobileOrder: 7 },
      { href: "/admin/book", label: "ספר פיתוח", icon: BookOpen, mobileOrder: 8 },
      { href: "/admin/course", label: "הקורס הדיגיטלי", icon: GraduationCap, mobileOrder: 10 },
      { href: "/admin/workouts/exercises", label: "תרגילים ותוכניות", icon: Dumbbell, mobileOrder: 9 },
    ],
  },
  {
    label: "תפעול",
    items: [
      { href: "/admin/calendar", label: "יומן", icon: CalendarDays, mobileOrder: 1 },
      { href: "/admin/schedule", label: "בניית אימונים", icon: ClipboardList, mobileOrder: 2 },
      { href: "/admin/tasks", label: "משימות", icon: ListChecks, mobileOrder: 5 },
      { href: "/admin/end-of-shift", label: "דוח משמרת", icon: ClipboardCheck, mobileOrder: 3 },
      { href: "/admin/shifts", label: "שעות עבודה", icon: Clock, mobileOrder: 4 },
      { href: "/admin/safety", label: "נוהל בטיחות", icon: ShieldAlert, mobileOrder: 6 },
    ],
  },
  {
    label: "שיווק ולקוחות",
    items: [
      { href: "/admin/leads", label: "לידים", icon: UserPlus, mobileOrder: 1 },
      { href: "/admin/retention", label: "שימור לקוחות", icon: RefreshCw, mobileOrder: 6 },
      { href: "/admin/orders", label: "הזמנות", icon: Receipt, adminOnly: true, mobileOrder: 7 },
    ],
  },
  {
    label: "הגדרות",
    items: [
      { href: "/admin/branches", label: "סניפים", icon: MapPin, adminOnly: true, mobileOrder: 9 },
    ],
  },
];

export const ADMIN_NAV_FLAT: NavItem[] = ADMIN_NAV_SECTIONS.flatMap((s) => s.items);

export const ADMIN_PAGE_TITLES = derivePageTitles(ADMIN_NAV_FLAT, {
  "/admin/reports/generate": "סיכום שחקן",
  "/admin/plans/products": "קטלוג מסלולים",
});
