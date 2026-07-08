import type { LucideIcon } from "lucide-react";

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
