import { ClipboardList } from "lucide-react";
import { describe, expect, test } from "vitest";
import { isNavItemVisible, type NavItem } from "../types";

const item = (over: Partial<NavItem>): NavItem => ({
  href: "/x",
  label: "x",
  icon: ClipboardList,
  ...over,
});

describe("isNavItemVisible", () => {
  test("adminOnly stays Admin-only", () => {
    expect(isNavItemVisible(item({ adminOnly: true }), { isAdmin: true, managesBranch: false })).toBe(true);
    expect(isNavItemVisible(item({ adminOnly: true }), { isAdmin: false, managesBranch: true })).toBe(false);
  });

  test("adminOrManager shows to Admins and managers only", () => {
    expect(isNavItemVisible(item({ adminOrManager: true }), { isAdmin: true, managesBranch: false })).toBe(true);
    expect(isNavItemVisible(item({ adminOrManager: true }), { isAdmin: false, managesBranch: true })).toBe(true);
    expect(isNavItemVisible(item({ adminOrManager: true }), { isAdmin: false, managesBranch: false })).toBe(false);
  });

  test("plain items show to all staff", () => {
    expect(isNavItemVisible(item({}), { isAdmin: false, managesBranch: false })).toBe(true);
  });
});
