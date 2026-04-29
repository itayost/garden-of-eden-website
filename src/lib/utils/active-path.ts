export function isActivePath(
  pathname: string,
  href: string,
  exact = false,
): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
