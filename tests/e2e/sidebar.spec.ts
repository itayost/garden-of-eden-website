import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES_TO_SCAN = ["/admin", "/dashboard"];

test.describe("desktop sidebar — accessibility", () => {
  for (const path of PAGES_TO_SCAN) {
    test(`${path} sidebar (expanded) has no axe color-contrast or aria-required-children violations`, async ({
      page,
    }) => {
      await page.goto(path);
      const sidebar = page.locator("[data-slot='sidebar']");
      await expect(sidebar).toBeVisible();
      await expect(sidebar).toHaveAttribute("data-state", "expanded");

      const expandedResults = await new AxeBuilder({ page })
        .include("[data-sidebar='sidebar']")
        .withRules([
          "color-contrast",
          "aria-required-children",
          "heading-order",
          "empty-heading",
        ])
        .analyze();
      expect(expandedResults.violations).toEqual([]);

      await page.locator("[data-sidebar='trigger']").click();
      await expect(sidebar).toHaveAttribute("data-state", "collapsed");

      const collapsedResults = await new AxeBuilder({ page })
        .include("[data-sidebar='sidebar']")
        .withRules([
          "color-contrast",
          "aria-required-children",
          "heading-order",
          "empty-heading",
        ])
        .analyze();
      expect(collapsedResults.violations).toEqual([]);

      await page.locator("[data-sidebar='trigger']").click();
      await expect(sidebar).toHaveAttribute("data-state", "expanded");
    });
  }

  test("/admin sidebar marks the current page item with aria-current='page'", async ({
    page,
  }) => {
    await page.goto("/admin/users");
    const current = page.locator("[aria-current='page']");
    await expect(current).toHaveCount(1);
    await expect(current).toContainText("משתמשים");
  });
});

const HEADING_ROUTES = [
  "/admin",
  "/admin/users",
  "/admin/assessments",
  "/admin/nutrition",
  "/admin/submissions",
  "/admin/end-of-shift",
  "/admin/shifts",
  "/admin/leads",
  "/admin/upcoming-games",
  "/admin/retention",
  "/admin/videos",
  "/dashboard",
  "/dashboard/assessments",
  "/dashboard/rankings",
  "/dashboard/forms",
  "/dashboard/forms/next-game",
  "/dashboard/forms/nutrition",
  "/dashboard/forms/post-workout",
  "/dashboard/forms/pre-workout",
  "/dashboard/nutrition",
  "/dashboard/videos",
  "/dashboard/settings/security",
];

test.describe("heading hierarchy — one h1 per page", () => {
  for (const route of HEADING_ROUTES) {
    test(`${route} has exactly one h1`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("h1")).toHaveCount(1);
    });
  }
});
