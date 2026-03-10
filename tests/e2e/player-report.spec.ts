import { test, expect } from "@playwright/test";
import { ReportPage } from "./pages/ReportPage";
import { UserDetailPage } from "./pages/UserDetailPage";

/**
 * E2E tests for the Player Summary Report feature.
 *
 * Prerequisites:
 *   - Auth setup has run (admin session stored in .auth/admin.json)
 *   - E2E_TRAINEE_USER_ID env var set to a trainee's UUID in the database
 *   - E2E_TRAINEE_NAME env var set to the trainee's display name
 */

const traineeUserId = process.env.E2E_TRAINEE_USER_ID ?? "";
const traineeName = process.env.E2E_TRAINEE_NAME ?? "";

test.describe("Player Report Generation", () => {
  test.beforeEach(() => {
    test.skip(
      !traineeUserId || !traineeName,
      "E2E_TRAINEE_USER_ID and E2E_TRAINEE_NAME must be configured",
    );
  });

  test("navigates to report from user detail page", async ({ page }) => {
    const userPage = new UserDetailPage(page);
    await userPage.goto(traineeUserId);
    await userPage.navigateToReport();

    const reportPage = new ReportPage(page);
    await reportPage.expectLoaded(traineeName);
  });

  test("report page loads with all sections visible", async ({ page }) => {
    const reportPage = new ReportPage(page);
    await reportPage.goto(traineeUserId);

    // Title
    await expect(reportPage.title).toContainText("סיכום פעילות שחקן");

    // Details section
    await expect(reportPage.detailsSection).toBeVisible();

    // Summary section
    await expect(reportPage.summarySection).toBeVisible();
    await expect(reportPage.summaryTextarea).toBeVisible();

    // PDF button
    await expect(reportPage.downloadPdfButton).toBeVisible();
    await expect(reportPage.downloadPdfButton).toContainText("הורד PDF");

    // Date range controls
    await expect(reportPage.fromDateInput).toBeVisible();
    await expect(reportPage.toDateInput).toBeVisible();
    await expect(reportPage.updateDateRangeButton).toBeVisible();
  });

  test("date range change refreshes data", async ({ page }) => {
    const reportPage = new ReportPage(page);
    await reportPage.goto(traineeUserId);

    // Get initial title text
    const initialTitle = await reportPage.title.textContent();

    // Change date range to a narrow window
    await reportPage.setDateRange("2026-01-01", "2026-01-31");

    // Page should still be loaded (title stays the same)
    const updatedTitle = await reportPage.title.textContent();
    expect(updatedTitle).toBe(initialTitle);

    // Update button should be re-enabled after fetch
    await expect(reportPage.updateDateRangeButton).toBeEnabled();
  });

  test("can add and see strength bullet item", async ({ page }) => {
    const reportPage = new ReportPage(page);
    await reportPage.goto(traineeUserId);

    const testText = `E2E-test-strength-${Date.now()}`;
    await reportPage.addBulletItem("strengths", testText);
    await reportPage.expectBulletItemVisible(testText);
  });

  test("can add and see weakness bullet item", async ({ page }) => {
    const reportPage = new ReportPage(page);
    await reportPage.goto(traineeUserId);

    const testText = `E2E-test-weakness-${Date.now()}`;
    await reportPage.addBulletItem("weaknesses", testText);
    await reportPage.expectBulletItemVisible(testText);
  });

  test("can add and see social skills bullet item", async ({ page }) => {
    const reportPage = new ReportPage(page);
    await reportPage.goto(traineeUserId);

    const testText = `E2E-test-social-${Date.now()}`;
    await reportPage.addBulletItem("socialSkills", testText);
    await reportPage.expectBulletItemVisible(testText);
  });

  test("can remove a bullet item", async ({ page }) => {
    const reportPage = new ReportPage(page);
    await reportPage.goto(traineeUserId);

    const testText = `E2E-remove-test-${Date.now()}`;
    await reportPage.addBulletItem("strengths", testText);
    await reportPage.expectBulletItemVisible(testText);

    // Remove the item via POM
    await reportPage.removeBulletItem(testText);

    // Item should be gone
    await reportPage.expectBulletItemNotVisible(testText);
  });

  test("can write and save summary", async ({ page }) => {
    const reportPage = new ReportPage(page);
    await reportPage.goto(traineeUserId);

    const summaryText = `E2E test summary ${Date.now()}`;
    await reportPage.writeSummary(summaryText);

    // Save button should be enabled
    await expect(reportPage.saveSummaryButton).toBeEnabled();

    await reportPage.saveSummary();

    // Wait for success toast
    await expect(page.locator('[data-sonner-toast]')).toContainText(
      "הסיכום נשמר בהצלחה",
    );
  });

  test("save summary button is disabled when textarea is empty", async ({
    page,
  }) => {
    const reportPage = new ReportPage(page);
    await reportPage.goto(traineeUserId);

    // Clear textarea
    await reportPage.summaryTextarea.fill("");

    await expect(reportPage.saveSummaryButton).toBeDisabled();
  });

  test("PDF download button triggers generation", async ({ page }) => {
    const reportPage = new ReportPage(page);
    await reportPage.goto(traineeUserId);

    // Set up download listener
    const downloadPromise = page.waitForEvent("download", { timeout: 30000 });

    await reportPage.downloadPdfButton.click();

    // Button should show loading state
    await expect(reportPage.downloadPdfButton).toContainText("מייצר PDF...");

    // Wait for download to start
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("סיכום-שחקן");

    // Button should return to normal
    await expect(reportPage.downloadPdfButton).toContainText("הורד PDF");
  });

  test("unauthenticated user is redirected to login", async ({ browser }) => {
    // Create context WITHOUT stored auth
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`/admin/reports/generate/${traineeUserId}`);

    // Should redirect to login
    await page.waitForURL(/\/auth\/login/);
    await context.close();
  });
});
