import { type Locator, type Page, expect } from "@playwright/test";

export class UserDetailPage {
  readonly page: Page;
  readonly generateReportButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.generateReportButton = page.getByTestId("generate-report-link");
  }

  async goto(userId: string) {
    await this.page.goto(`/admin/users/${userId}`);
  }

  async navigateToReport() {
    await expect(this.generateReportButton).toBeVisible();
    await this.generateReportButton.click();
    await this.page.waitForURL(/\/admin\/reports\/generate\//);
  }
}
