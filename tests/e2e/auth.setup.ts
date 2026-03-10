import { test as setup, expect } from "@playwright/test";

/**
 * Authenticate as admin/trainer before E2E tests.
 *
 * Requires environment variables:
 *   E2E_ADMIN_PHONE  – admin phone number (e.g. "0501234567")
 *   E2E_ADMIN_OTP    – static OTP for test env (Supabase test OTP)
 *
 * Saves session cookies to .auth/admin.json for reuse across tests.
 */
setup("authenticate as admin", async ({ page }) => {
  const phone = process.env.E2E_ADMIN_PHONE;
  const otp = process.env.E2E_ADMIN_OTP;

  if (!phone || !otp) {
    throw new Error(
      "E2E_ADMIN_PHONE and E2E_ADMIN_OTP must be set. " +
        "Configure a test OTP in Supabase Dashboard > Authentication > Phone Provider.",
    );
  }

  // Navigate to login page
  await page.goto("/auth/login");

  // Enter phone number and submit
  await page.getByRole("textbox").fill(phone);
  await page.getByRole("button", { name: /שלח|כניסה|אימות/ }).click();

  // Wait for OTP input to appear (may stay on same page or navigate)
  await page.waitForURL(/otp|verify/, { timeout: 10000 }).catch(async () => {
    // OTP input may render on the same page — verify we're still on a login-related URL
    const url = page.url();
    if (!/auth/.test(url) && !/login/.test(url) && !/otp/.test(url)) {
      throw new Error(`Unexpected URL after phone submit: ${url}`);
    }
  });

  // Fill OTP digits — scope to numeric inputs to avoid matching phone field
  const otpInputs = page.locator(
    'input[inputmode="numeric"], input[autocomplete="one-time-code"]',
  );
  const count = await otpInputs.count();

  if (count >= 6) {
    // Individual digit inputs
    for (let i = 0; i < 6; i++) {
      await otpInputs.nth(i).fill(otp[i]);
    }
  } else if (count > 0) {
    // Single OTP input
    await otpInputs.first().fill(otp);
  } else {
    throw new Error("No OTP inputs found on the page");
  }

  // Submit OTP
  await page.getByRole("button", { name: /אימות|כניסה|אישור/ }).click();

  // Wait for redirect to admin area and confirm we landed correctly
  await page.waitForURL(/\/admin/, { timeout: 15000 });
  await expect(page.locator("body")).toBeVisible();

  // Save signed-in state
  await page.context().storageState({ path: ".auth/admin.json" });
});
