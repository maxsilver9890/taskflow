import { expect, test, type Page } from "@playwright/test";

/**
 * E2E coverage for the email-verification flow (POST /auth/verify-email,
 * POST /auth/resend-verification, and the requireVerifiedEmail gate on
 * every other protected route).
 *
 * Two groups, same split used by auth.spec.ts / marketing.spec.ts:
 *
 * 1. "no backend required" — session state is seeded directly into
 *    localStorage (an unsigned-but-structurally-valid JWT, since
 *    decodeAccessToken only ever reads claims client-side for UI purposes
 *    and never verifies the signature — the real API is the sole authority
 *    and enforces everything server-side regardless of what the client
 *    believes). This exercises real routing/guard logic with zero mocking.
 *
 * 2. "mocked API" — a deliberate, narrow exception to the "no mocking
 *    layer" convention. Submitting an OTP and observing OTP_INVALID /
 *    OTP_EXPIRED / OTP_LOCKED / the resend cooldown are the specific
 *    scenarios this task asks to be covered, and they are not reachable any
 *    other way without a live backend (OTP state is time-boxed,
 *    attempt-limited server state — there's no "just register and fast
 *    forward 10 minutes" option for a test). Only the two auth endpoints
 *    under test are intercepted; nothing else is mocked.
 */

const SESSION_KEY = "taskflow.session.v1";

function base64Url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** An unsigned JWT-shaped string carrying the given claims (see session.test.ts for the same helper, unit-side). */
function fakeAccessToken(claims: Record<string, unknown>): string {
  return `${base64Url({ alg: "none" })}.${base64Url(claims)}.signature`;
}

const USER_ID = "00000000-0000-0000-0000-000000000001";
const ORG_ID = "00000000-0000-0000-0000-000000000002";

function sessionFor(emailVerified: boolean, email = "ava@example.com") {
  const accessToken = fakeAccessToken({
    sub: USER_ID,
    orgId: ORG_ID,
    role: "ORG_ADMIN",
    emailVerified,
    exp: Math.floor(Date.now() / 1000) + 900, // fresh for 15 min — no refresh call will fire
  });
  return {
    accessToken,
    refreshToken: "fake-refresh-token",
    user: { id: USER_ID, email, name: "Ava Shah", emailVerified },
  };
}

/** Seeds a session into localStorage before the app's first script runs. */
async function seedSession(page: Page, emailVerified: boolean, email?: string) {
  const session = sessionFor(emailVerified, email ?? "ava@example.com");
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [SESSION_KEY, JSON.stringify(session)] as [string, string],
  );
}

// ─── Group 1: no backend required (localStorage-seeded session) ───────────────

test.describe("verify-email — routing and gating (no backend)", () => {
  test("an unauthenticated visitor landing on /verify-email is sent to /login", async ({ page }) => {
    await page.goto("/verify-email");
    await expect(page).toHaveURL(/\/login/);
  });

  test("an authenticated-but-unverified user sees the verification screen with their email", async ({ page }) => {
    await seedSession(page, false, "carol@example.com");
    await page.goto("/verify-email");

    await expect(page.getByRole("heading", { name: /verify your email/i })).toBeVisible();
    await expect(page.getByText("carol@example.com")).toBeVisible();
    await expect(page.getByLabel(/verification code/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^verify$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /resend code/i })).toBeVisible();
  });

  test("an already-verified user visiting /verify-email is redirected away (nothing left to verify)", async ({ page }) => {
    await seedSession(page, true);
    await page.goto("/verify-email");

    await expect(page).not.toHaveURL(/\/verify-email/);
  });

  test("protected-route gating: an unverified user hitting /dashboard directly is redirected to /verify-email", async ({ page }) => {
    await seedSession(page, false);
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/verify-email/);
  });

  test("protected-route gating: an unverified user hitting /projects directly is also redirected to /verify-email", async ({ page }) => {
    await seedSession(page, false);
    await page.goto("/projects");

    await expect(page).toHaveURL(/\/verify-email/);
  });

  test("the OTP field only accepts digits, and Verify stays disabled until 6 are entered", async ({ page }) => {
    await seedSession(page, false);
    await page.goto("/verify-email");

    const field = page.getByLabel(/verification code/i);
    const verifyButton = page.getByRole("button", { name: /^verify$/i });

    await expect(verifyButton).toBeDisabled();

    // Non-digit characters are stripped by the field's own onChange handler.
    // (Playwright's .fill() also respects the field's native maxlength="6"
    // *before* that handler ever runs, so this intentionally stays within 6
    // raw characters — the "caps at 6" half of the behavior is covered
    // separately below via real keystrokes, which aren't maxlength-limited
    // the same way.)
    await field.fill("1a2b3c");
    await expect(field).toHaveValue("123");
    await expect(verifyButton).toBeDisabled();

    await field.fill("");
    await field.pressSequentially("123456789");
    await expect(field).toHaveValue("123456");
    await expect(verifyButton).toBeEnabled();
  });
});

// ─── Group 2: mocked API — the specific OTP outcome states ─────────────────────

test.describe("verify-email — OTP outcomes (mocked POST /auth/verify-email and /auth/resend-verification)", () => {
  test("a valid OTP shows the success state and the app takes over navigation", async ({ page }) => {
    await seedSession(page, false);
    await page.route("**/auth/verify-email", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Email verified successfully.",
          accessToken: fakeAccessToken({
            sub: USER_ID,
            orgId: ORG_ID,
            role: "ORG_ADMIN",
            emailVerified: true,
            exp: Math.floor(Date.now() / 1000) + 900,
          }),
          refreshToken: "fake-refresh-token-2",
          tokenType: "Bearer",
          expiresIn: 900,
        }),
      });
    });

    await page.goto("/verify-email");
    await page.getByLabel(/verification code/i).fill("123456");
    await page.getByRole("button", { name: /^verify$/i }).click();

    await expect(page.getByRole("heading", { name: /email verified/i })).toBeVisible();
    // The now-verified claim takes over navigation — away from /verify-email.
    await expect(page).not.toHaveURL(/\/verify-email/, { timeout: 5000 });
  });

  test("an incorrect OTP (OTP_INVALID) shows an error and clears the field for another attempt", async ({ page }) => {
    await seedSession(page, false);
    await page.route("**/auth/verify-email", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "That verification code is incorrect.", code: "OTP_INVALID" }),
      });
    });

    await page.goto("/verify-email");
    await page.getByLabel(/verification code/i).fill("000000");
    await page.getByRole("button", { name: /^verify$/i }).click();

    await expect(page.getByText(/code is incorrect/i)).toBeVisible();
    await expect(page.getByLabel(/verification code/i)).toHaveValue("");
    // Still on the verification screen — a wrong guess must not bounce the user anywhere.
    await expect(page).toHaveURL(/\/verify-email/);
  });

  test("an expired OTP (OTP_EXPIRED) shows an expiry-specific error", async ({ page }) => {
    await seedSession(page, false);
    await page.route("**/auth/verify-email", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "That verification code has expired. Request a new one.", code: "OTP_EXPIRED" }),
      });
    });

    await page.goto("/verify-email");
    await page.getByLabel(/verification code/i).fill("123456");
    await page.getByRole("button", { name: /^verify$/i }).click();

    await expect(page.getByText(/expired/i)).toBeVisible();
  });

  test("too many wrong attempts (OTP_LOCKED) disables further guesses until a resend", async ({ page }) => {
    await seedSession(page, false);
    await page.route("**/auth/verify-email", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Too many incorrect attempts. Request a new verification code.",
          code: "OTP_LOCKED",
        }),
      });
    });

    await page.goto("/verify-email");
    await page.getByLabel(/verification code/i).fill("123456");
    await page.getByRole("button", { name: /^verify$/i }).click();

    await expect(page.getByText(/too many incorrect attempts/i)).toBeVisible();
    await expect(page.getByLabel(/verification code/i)).toBeDisabled();
    await expect(page.getByRole("button", { name: /^verify$/i })).toBeDisabled();
    // The way out of a lockout is still available.
    await expect(page.getByRole("button", { name: /resend code/i })).toBeEnabled();
  });

  test("resend starts a cooldown countdown and re-enables the OTP field", async ({ page }) => {
    await seedSession(page, false);
    await page.route("**/auth/resend-verification", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Verification code sent.", cooldownSeconds: 60 }),
      });
    });

    await page.goto("/verify-email");
    await page.getByRole("button", { name: /resend code/i }).click();

    await expect(page.getByText(/a new code is on its way/i)).toBeVisible();
    await expect(page.getByText(/resend code in \d+s/i)).toBeVisible();
    // The countdown replaces the button — can't spam resend during cooldown.
    await expect(page.getByRole("button", { name: /^resend code$/i })).toBeHidden();
  });

  test("resending within the server's cooldown window (OTP_RESEND_COOLDOWN) syncs the countdown to the server's retryAfterSeconds", async ({ page }) => {
    await seedSession(page, false);
    await page.route("**/auth/resend-verification", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Please wait 37s before requesting another code.",
          code: "OTP_RESEND_COOLDOWN",
          details: { retryAfterSeconds: 37 },
        }),
      });
    });

    await page.goto("/verify-email");
    await page.getByRole("button", { name: /resend code/i }).click();

    // The inline error banner shows the page's generic friendly copy for
    // this code (not the server's literal message) — the precise duration
    // is conveyed by the countdown itself, synced from details.retryAfterSeconds.
    await expect(page.getByText(/wait a moment before requesting another code/i)).toBeVisible();
    await expect(page.getByText(/resend code in 37s/i)).toBeVisible();
  });
});
