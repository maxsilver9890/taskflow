import { expect, test } from "@playwright/test";

/**
 * Smoke tests for the auth pages that don't require a live backend —
 * rendering, navigation, and client-side field requirements only. Actually
 * submitting login/forgot-password/reset-password hits the real API, so
 * that's left to manual/staging testing until CI has a backend+DB wired up
 * (see playwright.config.ts and .github/workflows/frontend-ci.yml).
 */

test.describe("auth pages", () => {
  test("login page has a 'Forgot password?' link to the reset flow", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("link", { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole("heading", { name: /forgot your password/i })).toBeVisible();
  });

  test("forgot-password form requires an email before it can be submitted", async ({ page }) => {
    await page.goto("/forgot-password");

    const emailField = page.getByLabel("Email");
    await expect(emailField).toHaveAttribute("required", "");

    await page.getByRole("button", { name: /send reset link/i }).click();
    // Native HTML validation blocks submission, so the success state never
    // appears and we're still on the same page.
    await expect(page.getByRole("heading", { name: /check your email/i })).toBeHidden();
  });

  test("reset-password page renders without a token", async ({ page }) => {
    await page.goto("/reset-password");

    await expect(page.locator("body")).toBeVisible();
  });
});
