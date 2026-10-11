import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config (F3). These tests drive the real UI against a running
 * `npm run dev` frontend AND a running TaskFlow backend (Postgres + Redis +
 * API) — there is no mocking layer. They are not run in CI yet (see
 * .github/workflows/frontend-ci.yml's disabled `e2e` job) because CI has no
 * backend/database wired up, the same limitation documented for the
 * backend's own integration tests.
 *
 * To run locally:
 *   1. Start the backend stack (docker compose up, or see its README).
 *   2. In taskflow-frontend: npm run dev
 *   3. In another terminal: npm run test:e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
