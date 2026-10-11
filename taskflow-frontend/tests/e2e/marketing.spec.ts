import { expect, test } from "@playwright/test";

/**
 * Smoke tests for the public marketing site. These only exercise
 * client-rendered, backend-independent pages, so they're safe to run
 * against a plain `npm run dev` with no API/DB behind it.
 */

test.describe("marketing site", () => {
  test("home page renders the hero and primary CTAs", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("#heroHeadline")).toContainText("Assign the work.");
    await expect(page.getByRole("link", { name: /get started free/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^sign in$/i }).first()).toBeVisible();
  });

  test("sign in link navigates to the login page", async ({ page }) => {
    await page.goto("/");
    // Scope to the top nav to avoid the duplicate "Sign in" CTA further
    // down the page.
    await page.getByRole("navigation").getByRole("link", { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});
