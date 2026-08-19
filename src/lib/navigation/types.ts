import type { LucideIcon } from "lucide-react";
import { isPathAllowedForTier, type AccessTier } from "@/lib/access/course-access";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  adminOnly?: boolean;
  mobilePrimary?: boolean;
  // Order within the mobile bottom-nav bar / "עוד" sheet (independent of the
  // sidebar's list order, so both surfaces read one config yet keep their own order).
  mobileOrder?: number;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export function splitBottomNav(
  items: NavItem[],
  isAdmin: boolean,
): { main: NavItem[]; more: NavItem[] } {
  const visible = items.filter((i) => !i.adminOnly || isAdmin);
  const byMobileOrder = (a: NavItem, b: NavItem) =>
    (a.mobileOrder ?? Number.MAX_SAFE_INTEGER) -
    (b.mobileOrder ?? Number.MAX_SAFE_INTEGER);
  return {
    main: visible.filter((i) => i.mobilePrimary).sort(byMobileOrder),
    more: visible.filter((i) => !i.mobilePrimary).sort(byMobileOrder),
  };
}

export function derivePageTitles(
  items: NavItem[],
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    ...Object.fromEntries(items.map((i) => [i.href, i.label])),
    ...extra,
  };
}

/**
 * Drop nav items the tier cannot open.
 *
 * Cosmetic only -- the middleware is what actually enforces access. This just
 * stops a course-only trainee being shown links that would bounce them straight
 * back to the course.
 */
export function filterNavForTier(
  items: NavItem[],
  tier: AccessTier,
): NavItem[] {
  if (tier === "full") return items;
  return items.filter((item) => isPathAllowedForTier(tier, item.href));
}
