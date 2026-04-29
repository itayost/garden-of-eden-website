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
        .withRules(["color-contrast", "aria-required-children"])
        .analyze();
      expect(expandedResults.violations).toEqual([]);

      await page.locator("[data-sidebar='trigger']").click();
      await expect(sidebar).toHaveAttribute("data-state", "collapsed");

      const collapsedResults = await new AxeBuilder({ page })
        .include("[data-sidebar='sidebar']")
        .withRules(["color-contrast", "aria-required-children"])
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
