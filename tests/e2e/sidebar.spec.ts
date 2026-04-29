import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES_TO_SCAN = ["/admin", "/dashboard"];

test.describe("desktop sidebar — accessibility", () => {
  for (const path of PAGES_TO_SCAN) {
    test(`${path} sidebar (expanded) has no axe color-contrast or aria-required-children violations`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.locator("[data-sidebar='sidebar']")).toBeVisible();

      const expandedResults = await new AxeBuilder({ page })
        .include("[data-sidebar='sidebar']")
        .withRules(["color-contrast", "aria-required-children"])
        .analyze();
      expect(expandedResults.violations).toEqual([]);

      await page.locator("[data-sidebar='trigger']").click();
      // Wait for collapse animation to finish.
      await page.waitForTimeout(400);

      const collapsedResults = await new AxeBuilder({ page })
        .include("[data-sidebar='sidebar']")
        .withRules(["color-contrast", "aria-required-children"])
        .analyze();
      expect(collapsedResults.violations).toEqual([]);

      // Restore expanded state for the next test.
      await page.locator("[data-sidebar='trigger']").click();
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
