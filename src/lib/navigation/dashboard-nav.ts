import {
  BookOpen,
  Dumbbell,
  FileText,
  GraduationCap,
  Home,
  Target,
  Trophy,
  UserCog,
  Users,
  Utensils,
  Video,
} from "lucide-react";
import { derivePageTitles, type NavItem } from "@/lib/navigation/types";

// sidebar order = array order; mobile bar/sheet order = mobileOrder (preserves the
// previous mobile ordering while sharing one list with the sidebar).
export const DASHBOARD_NAV: NavItem[] = [
  { href: "/dashboard", label: "ראשי", icon: Home, exact: true, mobilePrimary: true, mobileOrder: 1 },
  { href: "/dashboard/assessments", label: "מבדקים", icon: Target, mobilePrimary: true, mobileOrder: 2 },
  { href: "/dashboard/rankings", label: "דירוג", icon: Trophy, mobilePrimary: true, mobileOrder: 4 },
  { href: "/dashboard/forms", label: "שאלונים", icon: FileText, mobilePrimary: true, mobileOrder: 3 },
  { href: "/dashboard/workout", label: "האימון שלי", icon: Dumbbell, mobileOrder: 1 },
  { href: "/dashboard/nutrition", label: "תזונה", icon: Utensils, mobileOrder: 2 },
  { href: "/dashboard/videos", label: "סרטונים", icon: Video, mobileOrder: 1 },
  { href: "/dashboard/course", label: "הקורס הדיגיטלי", icon: GraduationCap, mobileOrder: 2 },
  { href: "/dashboard/book", label: "ספר פיתוח", icon: BookOpen, mobileOrder: 3 },
  { href: "/dashboard/book/parents", label: "להורים", icon: Users, mobileOrder: 4 },
  { href: "/dashboard/profile", label: "פרופיל", icon: UserCog, mobileOrder: 5 },
];

export const DASHBOARD_PAGE_TITLES = derivePageTitles(DASHBOARD_NAV, {
  "/dashboard/book/parents": "להורים",
  "/dashboard/forms/next-game": "המשחק הבא שלי",
  "/dashboard/forms/nutrition": "שאלון תזונה",
  "/dashboard/forms/post-workout": "שאלון אחרי אימון",
  "/dashboard/forms/pre-workout": "שאלון לפני אימון",
  "/dashboard/forms/mental": "שאלון מנטלי",
  "/dashboard/settings": "הגדרות",
  "/dashboard/settings/security": "אבטחה",
});
