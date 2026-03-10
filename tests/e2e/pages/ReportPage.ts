import { type Locator, type Page, expect } from "@playwright/test";

export class ReportPage {
  readonly page: Page;

  // Main container
  readonly editor: Locator;
  readonly title: Locator;

  // Date range controls
  readonly fromDateInput: Locator;
  readonly toDateInput: Locator;
  readonly updateDateRangeButton: Locator;

  // Sections
  readonly detailsSection: Locator;
  readonly assessmentsSection: Locator;
  readonly summarySection: Locator;

  // Summary controls
  readonly summaryTextarea: Locator;
  readonly saveSummaryButton: Locator;

  // PDF
  readonly downloadPdfButton: Locator;

  // Bullet lists (by title text)
  readonly strengthsCard: Locator;
  readonly weaknessesCard: Locator;
  readonly socialSkillsCard: Locator;

  constructor(page: Page) {
    this.page = page;

    this.editor = page.getByTestId("report-editor");
    this.title = page.getByTestId("report-title");

    this.fromDateInput = page.locator("#fromDate");
    this.toDateInput = page.locator("#toDate");
    this.updateDateRangeButton = page.getByTestId("update-date-range");

    this.detailsSection = page.getByTestId("report-details");
    this.assessmentsSection = page.getByTestId("report-assessments");
    this.summarySection = page.getByTestId("report-summary");

    this.summaryTextarea = page.getByTestId("summary-textarea");
    this.saveSummaryButton = page.getByTestId("save-summary");

    this.downloadPdfButton = page.getByTestId("download-pdf");

    // Locate bullet list cards by stable test IDs
    this.strengthsCard = page.getByTestId("bullet-section-strengths");
    this.weaknessesCard = page.getByTestId("bullet-section-weaknesses");
    this.socialSkillsCard = page.getByTestId("bullet-section-social-skills");
  }

  async goto(userId: string) {
    await this.page.goto(`/admin/reports/generate/${userId}`);
    await this.editor.waitFor({ state: "visible" });
  }

  async expectLoaded(playerName: string) {
    await expect(this.title).toContainText(playerName);
    await expect(this.detailsSection).toBeVisible();
  }

  async setDateRange(from: string, to: string) {
    await this.fromDateInput.fill(from);
    await this.toDateInput.fill(to);
    await this.updateDateRangeButton.click();
    // Wait for the fetch to complete (button re-enables when done)
    await expect(this.updateDateRangeButton).toBeEnabled({ timeout: 10000 });
  }

  async writeSummary(text: string) {
    await this.summaryTextarea.fill(text);
  }

  async saveSummary() {
    await this.saveSummaryButton.click();
  }

  async addBulletItem(
    section: "strengths" | "weaknesses" | "socialSkills",
    text: string,
  ) {
    const prefix =
      section === "strengths"
        ? "strengths"
        : section === "weaknesses"
          ? "weaknesses"
          : "social-skills";

    const input = this.page.getByTestId(`${prefix}-add-input`);
    const button = this.page.getByTestId(`${prefix}-add-button`);

    await input.fill(text);
    await button.click();
  }

  async removeBulletItem(text: string) {
    const itemInput = this.page.locator(`input[value="${text}"]`);
    const row = itemInput.locator("xpath=ancestor::li");
    await row.getByRole("button", { name: "הסר פריט" }).click();
  }

  async expectBulletItemVisible(text: string) {
    await expect(this.page.locator(`input[value="${text}"]`)).toBeVisible();
  }

  async expectBulletItemNotVisible(text: string) {
    await expect(
      this.page.locator(`input[value="${text}"]`),
    ).not.toBeVisible();
  }
}
