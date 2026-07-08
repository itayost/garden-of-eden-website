import {
  BookOpen,
  FileText,
  Home,
  Target,
  Trophy,
  UserCog,
  Users,
  Utensils,
  Video,
} from "lucide-react";
import { derivePageTitles, type NavItem } from "@/lib/navigation/types";

export const DASHBOARD_NAV: NavItem[] = [
  { href: "/dashboard", label: "ראשי", icon: Home, exact: true, mobilePrimary: true },
  { href: "/dashboard/assessments", label: "מבדקים", icon: Target, mobilePrimary: true },
  { href: "/dashboard/rankings", label: "דירוג", icon: Trophy, mobilePrimary: true },
  { href: "/dashboard/forms", label: "שאלונים", icon: FileText, mobilePrimary: true },
  { href: "/dashboard/nutrition", label: "תזונה", icon: Utensils },
  { href: "/dashboard/videos", label: "סרטונים", icon: Video },
  { href: "/dashboard/book", label: "ספר פיתוח", icon: BookOpen },
  { href: "/dashboard/book/parents", label: "להורים", icon: Users },
  { href: "/dashboard/profile", label: "פרופיל", icon: UserCog },
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
