import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  adminOnly?: boolean;
  mobilePrimary?: boolean;
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
  return {
    main: visible.filter((i) => i.mobilePrimary),
    more: visible.filter((i) => !i.mobilePrimary),
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
