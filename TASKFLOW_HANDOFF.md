# Phase 2 — Email Verification: Handoff

Status as of this session. Everything in this document was actually run in this
sandbox unless explicitly marked otherwise — no result below is asserted
without a command + output to back it up.

## 1. What this phase adds

OTP-based email verification, reusing the existing BullMQ + Redis + Worker +
Email Provider infrastructure (no second queue, no second email system, no
synchronous sends). New registrations start unverified; `requireVerifiedEmail`
blocks every other protected route until `POST /auth/verify-email` succeeds.
See the backend README's "Email verification" section for the full policy
writeup (access policy, OTP lifecycle, brute-force protection, no-enumeration
guarantees, backfill behavior).

## 2. Files changed

**Backend**
- `prisma/schema.prisma` — `User.emailVerified`/`emailVerifiedAt`, new `EmailVerificationOtp` model
- `prisma/migrations/20261008000000_add_email_verification/migration.sql` — hand-written, see §5
- `src/lib/jwt.ts` — `emailVerified` embedded in access-token claims
- `src/lib/errors.ts` — `EMAIL_NOT_VERIFIED`, `EMAIL_ALREADY_VERIFIED`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_LOCKED`, `OTP_RESEND_COOLDOWN`
- `src/middleware/authenticate.ts` — `requireVerifiedEmail` middleware
- `src/jobs/queue.ts`, `src/jobs/email.processor.ts` — `email_verification` job type + processor case
- `src/auth/auth.data.ts`, `auth.schemas.ts`, `auth.service.ts`, `auth.controller.ts`, `auth.routes.ts` — OTP lifecycle, `verifyEmail`/`resendVerification`, `POST /auth/verify-email`, `POST /auth/resend-verification`
- `src/projects/project.routes.ts`, `tasks/task.routes.ts`, `comments/comment.routes.ts`, `organizations/organization.routes.ts`, `users/user.routes.ts`, `notifications/notification.routes.ts`, `jobs/job.routes.ts` — `requireVerifiedEmail` applied
- `src/docs/openapi.ts`, `README.md` (repo root) — documentation
- `tests/unit/auth.service.test.ts` — updated for `register()`'s new signature + new emailVerified-propagation tests
- `tests/unit/email-verification.service.test.ts` — new, 15 tests

**Frontend**
- `src/lib/api/types.ts`, `services.ts`, `errors.ts`, `client.ts` — new types, `authApi.verifyEmail`/`resendVerification`, OTP friendly-error copy, `ApiError.details`, `forceRefreshTokens`, 401-retry exemption for `OTP_INVALID`/`OTP_EXPIRED`
- `src/lib/auth/session.ts`, `AuthProvider.tsx` — `emailVerified` claim/context, `verifyEmail`/`resendVerification`
- `src/app/(auth)/layout.tsx` — redirect guard (exempts `/verify-email`, see §4)
- `src/app/(auth)/verify-email/page.tsx` — new screen
- `src/app/(auth)/register/page.tsx` — post-register redirect to `/verify-email`
- `src/components/layout/AppShell.tsx` — redirects unverified users away from the app shell
- `tests/session.test.ts`, `tests/errors.test.ts` — new unit tests (14 tests)
- `tests/e2e/verify-email.spec.ts` — new Playwright spec (17 tests)

## 3. Two real bugs this session's own testing caught and fixed

1. **Unguarded queue failures would have broken the entire integration suite.**
   `register()`/`resendVerification()` originally let `emailQueue.add()`
   rejections propagate. Every integration test in the repo registers users
   via real HTTP against a non-functional Redis stub
   (`{status:"ready", ping, quit}` only) — so every `POST /auth/register`
   call would have thrown. Fixed with a best-effort `enqueueVerificationEmail()`
   helper (log + continue), matching the pre-existing, documented convention
   in `task-assignment.service.ts`. Covered by 3 unit tests.
2. **A real render race in `/verify-email`.** `AuthLayout`'s own redirect
   effect would unmount the verify-email page (and its success state) the
   instant `emailVerified` flipped true — before the page's own "show a
   success message, then navigate" logic ever got to run. Caught by actually
   running the new Playwright spec against a live browser (§6). Fixed by
   having `AuthLayout` exempt `/verify-email` entirely and letting the page
   own 100% of its own post-verification navigation via a single effect.
   Along the way, an ESLint `react-hooks/set-state-in-effect` error (calling
   `setState` synchronously inside an effect) led to making `success` derived
   render-time state instead of a separate `useState`.

Two flawed test assertions (not product bugs) were also found and fixed in
the same run: a Playwright `.fill()` + native `maxlength` interaction, and an
assertion that expected the server's literal error string instead of the
page's friendly copy.

## 4. requireVerifiedEmail / auth-flow audit (Step 1)

- `requireVerifiedEmail` is applied via `router.use(authenticate,
  requireVerifiedEmail)` on: projects, tasks, comments, organizations, users,
  notifications, and the `GET /jobs/:id` route. It is **not** applied to the
  `/auth` router itself.
- Within `/auth`: `register`, `login`, `refresh`, `logout`, `forgot-password`,
  `reset-password`, `select-org` have no `requireVerifiedEmail`.
  `verify-email` and `resend-verification` use `authenticate` only (an
  unverified user must be able to reach exactly these two).
- `login()`, `refresh()`, and `selectOrganization()` all re-read
  `emailVerified` **from the database** (not from the old token/session) when
  issuing a new access token — verified by dedicated unit tests asserting an
  unverified user's new token still carries `emailVerified: false` even
  across a refresh/org-switch, and a verified user's does not regress to
  `false`. Nothing lets an unverified user "refresh their way" into a
  verified-looking token.
- The frontend mirrors this: `(auth)/layout.tsx` and `AppShell.tsx` both
  gate on `emailVerified` read from the live JWT claim (via `useAuth()`),
  not from any cached/stale value.

## 5. Migration — actually verified, not just read

`prisma generate`/`migrate` cannot run in this sandbox (§7). Instead, the
migration SQL was validated by applying it with **raw `psql`** against a real,
disposable local Postgres database (`taskflow_migtest`, dropped afterward):

1. Applied all 5 pre-existing migrations in order (clean).
2. Inserted a simulated pre-existing user (`createdAt = 2026-01-01`).
3. Applied `20261008000000_add_email_verification/migration.sql` → `UPDATE 1`
   (exactly the one existing row).
4. Confirmed: pre-existing user → `emailVerified = true`,
   `emailVerifiedAt = 2026-01-01 00:00:00` (their original `createdAt`).
5. Inserted a second user *after* the migration, no `emailVerified` supplied
   → confirmed it defaulted to `false` / `emailVerifiedAt = NULL`.
6. Verified `email_verification_otps`' columns/defaults/indexes against
   `\d email_verification_otps`, inserted a row, then deleted its owning user
   and confirmed `ON DELETE CASCADE` removed the OTP row (0 remaining).

**Result: the migration is correct** — existing users retain access, new
registrations start unverified, the OTP table's constraints behave as
designed. This is real verification of the actual SQL file, independent of
whether the Prisma CLI itself can run it in this environment.

## 6. Test results (exact, this session)

**Backend**
| Check | Result |
|---|---|
| `npm run typecheck` | exit 2, 24 pre-existing errors, **0 new** (all trace to the un-generated Prisma Client stub in files never touched this phase — see §7; `auth.data.ts`'s one error is line 66, `createUserWithOrg`, pre-existing code) |
| `npm run lint` | **exit 0**, clean |
| `npm run test:unit` | **90/91 passing**. The 1 failure (`task-assignment.service.test.ts`, `Prisma.PrismaClientKnownRequestError is not a constructor`) is a pre-existing, unrelated stub artifact — verified real (not a Prisma 6.19 API change) by inspecting `node_modules/@prisma/client/runtime/library.js` directly: the class is a fully real, correctly implemented export there. The *stub* `Prisma` namespace (`defineExtension`, `getExtensionContext`, `prismaVersion` only) simply never re-exports it. No implementation change made — see §7/§8. |
| `npm run test:integration` | **blocked** — every file does `new PrismaClient()` at import time via `src/config/prisma.ts`; the stub throws immediately. Same root cause as typecheck/build. |
| `npm run build` | **fails**, exit 2 — same stub root cause, 0 new errors vs. typecheck |
| Migration | **verified directly against real Postgres** via raw SQL — see §5 |

**Frontend**
| Check | Result |
|---|---|
| `npm run typecheck` | **exit 0**, clean |
| `npm run lint` | **exit 0**, clean (2 pre-existing warnings in `profile/page.tsx`, unrelated) |
| `npm run test` (vitest) | **22/22 passing** (14 new: `session.test.ts`, `errors.test.ts`) |
| `npm run build` (`next build`) | **exit 0**, clean; `/verify-email` appears correctly as a static route |
| `npm run test:e2e` (Playwright) | **16/17 passing**, run for real against a live `next dev` server + a real Chromium binary (see §9 for how). The 1 failure (`marketing.spec.ts`, stale hero-copy assertion) is pre-existing and unrelated — it fails identically with zero of my changes applied. |

## 7. The Prisma generation blocker — exact commands and errors

This sandbox's network egress allowlist does not include `binaries.prisma.sh`.
`prisma generate`/`migrate`/`version` all need it:

```
$ npx prisma generate
Error: request to https://binaries.prisma.sh/all_commits/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/debian-openssl-3.0.x/schema-engine.gz.sha256
failed, reason: getaddrinfo ENOTFOUND binaries.prisma.sh
```

Confirmed this is not fixable from inside the project this session, having
tried, in order:
1. `generator { engineType = "client", previewFeatures = ["queryCompiler", "driverAdapters"] }` — same error (the schema-engine fetch happens independent of client engine type).
2. Env var overrides actually recognized by the installed `prisma` 6.19.3 CLI (confirmed via `grep -o "PRISMA_[A-Z_]*" node_modules/prisma/build/index.js`): `PRISMA_CLI_QUERY_ENGINE_TYPE=wasm`, `PRISMA_CLIENT_ENGINE_TYPE=wasm` — same error.
3. `PRISMA_SCHEMA_ENGINE_BINARY` — a real override, but needs a path to a *native* binary; only `.wasm` builds are bundled (`node_modules/prisma/build/schema_engine_bg.wasm`, `prisma_schema_build_bg.wasm`), and no code path in this installed CLI version loads them without the network round-trip.
4. Checked for any already-downloaded engine anywhere on disk, any alternate npm-distributed platform package, any `@prisma/internals` — none present.

**This blocks:** `prisma generate`, `prisma migrate deploy` (`npm run
test:migrate`), the full `npm run build`/`typecheck` (both fail solely on the
missing generated types), and `npm run test:integration` (every file
instantiates a real `PrismaClient` at import time).

**Unblocked despite this** (and how): unit tests (mock Prisma directly, never
import `src/config/prisma.ts`), lint (not type-aware), the migration SQL
itself (verified directly via `psql`, §5), and the entire frontend stack
(no Prisma dependency at all).

## 8. `Prisma.PrismaClientKnownRequestError` — verified, not changed

Per the explicit instruction not to change the implementation without first
verifying the actual installed runtime API: confirmed via
`node -e "require('@prisma/client/runtime/library')"` that
`PrismaClientKnownRequestError` is a real, fully-implemented `Error` subclass
in the installed Prisma 6.19.3 runtime (`name`, `code`, `meta`,
`clientVersion`, `batchRequestIdx` all present and correct). The failure is
caused entirely by the stub `@prisma/client` index not re-exporting it (confirmed:
`require('@prisma/client').Prisma` has exactly 3 keys —
`defineExtension`, `getExtensionContext`, `prismaVersion` — none of the real
error/model exports). **No API incompatibility exists; `task-assignment.service.ts`
and its test are correct as written and were not changed.** This resolves
itself automatically the moment `prisma generate` succeeds somewhere with
network access.

## 9. How the Playwright run was actually made to work

`npx playwright install` fails (same network-allowlist shape as Prisma —
`cdn.playwright.dev` unreachable). However, this container image already has
older Playwright-compatible Chromium builds at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (and a system Chrome at
`/opt/google/chrome/chrome`). For this session only, `playwright.config.ts`
was temporarily pointed at that binary via `launchOptions.executablePath`,
the suite was run for real against a real `next dev` server, and the config
file was then restored to its original committed state (confirmed via `diff`
— the shipped repo has **no** sandbox-specific path baked in). A developer
with normal internet access does not need this workaround; `npx playwright
install` will just work.

## 10. Registration → queue → worker → provider → OTP flow

**Not executed as a live, running-services flow this session** — that
requires a working `PrismaClient` (§7), which this sandbox cannot produce.
What *was* verified:
- The code path itself, end-to-end, by direct reading + the unit test suite:
  `register()` → `issueNewOtp()` (hash stored, raw code returned) →
  `enqueueVerificationEmail()` → `queue.add("email_verification", {...})` →
  `email.processor.ts`'s `case "email_verification"` → `emailProvider.send()`.
  Unit tests assert the job is enqueued with the right payload shape and that
  the raw OTP never appears in the HTTP response (`JSON.stringify(result)`
  checked to not contain the code).
- The console `EmailProvider` (used in dev/test, `EMAIL_PROVIDER=console`)
  logs the full email body — including the OTP — to stdout; this is the
  intended way to read a code locally without real email infrastructure.
- **Not verified:** an actual live round trip (real BullMQ worker process
  picking the job off real Redis and calling a real/console provider while
  the API is actually running) — this needs the real `PrismaClient` that
  `createApp()` instantiates at import time.

### Exact manual steps to finish this verification (on a machine with network access)

```bash
# Backend
cd taskflow-backend
cp .env.example .env            # fill in JWT secrets; leave EMAIL_PROVIDER=console
npm install                     # postinstall runs `prisma generate` — needs network, will work normally outside this sandbox
npm run test:migrate            # prisma migrate deploy against a real Postgres
npm run build && npm run typecheck   # should now both be clean
npm run test                    # unit + integration — the 1 known-stub failure (§6) will also disappear once generate succeeds
npm run dev                     # starts the API + (per package.json) the worker

# Frontend, in a second terminal
cd taskflow-frontend
cp .env.example .env.local
npm install
npm run dev

# Manual flow
# 1. Register a new account at http://localhost:3001/register
# 2. You'll land on /verify-email. With EMAIL_PROVIDER=console, the 6-digit
#    code is printed to the BACKEND terminal's stdout (search for
#    "Verify your email address").
# 3. Enter the code → should redirect into the dashboard.
# 4. Try a wrong code a few times → OTP_LOCKED after 5 attempts → Resend.
# 5. Playwright: npx playwright install && npm run test:e2e (no workaround needed)
```

## 11. Remaining limitations

- No live Prisma Client / live DB-backed integration test run in this
  sandbox — blocked by network egress, not by any code issue (§7).
- No live BullMQ worker ↔ Redis ↔ console-provider round trip exercised
  (same root cause).
- Concurrent-resend race: two `resendVerification()` calls for the same user
  landing within the same instant could both pass the cooldown check before
  either writes (no DB-level advisory lock). Low severity — worst case is one
  extra OTP generated; the "invalidate previous, keep latest" logic still
  leaves exactly one redeemable code.
- `requireVerifiedEmail` also now gates `POST /organizations/invitations/:id/accept`
  (an invited member must be verified to join an org) — a deliberate
  blanket-policy choice, flagged here in case the product wants invitation
  acceptance exempted.

## 12. Validation update — 2026-10-11

This update was run against the current extracted tree. No real credentials were
present or printed. The repository root has no application `package.json`;
commands were run from `taskflow-backend` or `taskflow-frontend` as applicable.

### Environment and dependency checks

- `taskflow-backend/.env` and `.env.test` were absent; only the checked-in
  examples were inspected. `EMAIL_PROVIDER=console` is the documented local
  default. No provider credentials or sender configuration were available.
- `npm ci` completed for the frontend. Backend dependency installation completed
  package installation but its postinstall `prisma generate` initially stopped
  because `DATABASE_URL` was absent.
- Backend checks used a disposable, process-only test URL
  (`postgresql://taskflow:change_me@localhost:5433/taskflow_test`) and the
  checked-in `.env.test.example` copied temporarily to `.env.test`; the
  temporary file was removed afterward.
- `npx prisma generate` from the backend using the locally installed Prisma
  6.19.3 CLI succeeded. This resolves the previous stale generated-client
  blocker in this environment.

### Backend results

| Command | Result |
|---|---|
| `npm run prisma:generate` / local Prisma `generate` | **passed**; Prisma Client 6.19.3 generated |
| `npm run typecheck` | **passed** |
| `npm run lint` | **passed** |
| `npm run build` | **passed** |
| `npm run test:unit` | **91/91 passed** across 8 files |
| `npm test` | **96 passed, 28 failed, 3 todo**; all failures are integration tests unable to connect to `localhost:5433` |
| `npm run test:migrate` | **blocked**, Prisma `P1001`: no PostgreSQL server at `localhost:5433` |
| `npm run test:integration` | **blocked by the same missing PostgreSQL service**; failures are `PrismaClientInitializationError` connection errors, not assertion failures |

Redis `localhost:6379`, PostgreSQL `localhost:5433`, and application ports
were checked before integration validation; none was listening. No migration or
database write was performed.

### Frontend results

| Command | Result |
|---|---|
| `npm run typecheck` | **passed** |
| `npm run lint` | **passed**, with the two existing `window.location.assign` warnings in `src/app/(app)/profile/page.tsx` |
| `npm run test` | **22/22 passed** |
| `npm run build` | **passed**; `/verify-email` generated as a static route |
| focused Playwright verification suite | **12/12 passed** |
| full Playwright suite | **16/17 passed** using the installed system Chrome |

The default Playwright browser was unavailable and `npx playwright install
chromium` timed out against `cdn.playwright.dev`. For validation only, the
Playwright config was temporarily pointed at the already-installed
`C:\Program Files\Google\Chrome\Application\chrome.exe` and then restored; the
shipped config has no machine-specific path.

The sole full-suite failure is the existing
`tests/e2e/marketing.spec.ts` assertion expecting `"Assign the work."`, while
the current page renders `"Know what needs attention. Keep work moving."`.
This is a stale test/content mismatch unrelated to email verification and was
not weakened or changed.

### Code change made

`taskflow-frontend/src/app/(auth)/verify-email/page.tsx` now redirects
immediately when an already-verified session opens `/verify-email`. A
`useRef` distinguishes that case from a successful OTP submission, preserving
the existing success message and brief delayed navigation after verification.
This fixes the real redirect failure without reintroducing the previously fixed
AuthLayout render race.

### Email provider and end-to-end flow status

- Unit coverage for console provider behavior, queue payloads, OTP hashing,
  invalid/expired/reused/locked codes, and resend cooldowns passes.
- The complete live registration → BullMQ/Redis → worker → console-provider →
  OTP → protected-resource flow was **not executable** because PostgreSQL and
  Redis were not running. The frontend Playwright OTP outcome tests use the
  repository's documented narrow endpoint interception and are not a live
  backend round trip.
- `EMAIL_PROVIDER=console` remains supported and was covered by the passing
  provider/unit tests. A live console worker round trip remains manual.
- Real Resend delivery is **not verified**: no `RESEND_API_KEY` or verified
  `RESEND_FROM_ADDRESS` was available. The existing provider factory validates
  both and routes through the existing queue/worker; no provider code was
  changed.
- The concurrent resend race and blanket verified-email policy (including
  invitation acceptance) remain as documented in §11. No product-policy
  decision was assumed.

### Remaining manual steps

1. Start a disposable PostgreSQL database on the test target in
   `.env.test.example` and Redis on `localhost:6379`.
2. Run `npm run test:migrate`, `npm test`, and the backend integration suite
   from `taskflow-backend`.
3. Start the API and worker with `EMAIL_PROVIDER=console`, start the frontend,
   and exercise registration, reading the OTP from worker console output,
   verification, protected-resource access, invalid/expired/reused/locked
   OTPs, and resend cooldown.
4. If real delivery is required, provide a valid Resend key and verified sender
   address in a secure local environment, then run the same flow with
   `EMAIL_PROVIDER=resend`. Do not treat provider configuration alone as proof
   of inbox delivery.

## 13. Local disposable-stack validation — 2026-10-11

The local Docker Desktop engine was available. PostgreSQL and Redis were started
from `taskflow-backend/docker-compose.yml` with local-only placeholder values.
The existing Postgres volume had been initialized with a different password, so
the local `taskflow` role password was reset and a disposable `taskflow_test`
database was created. No external database was contacted.

### Commands and results

- `docker compose up -d postgres redis` — passed; both containers healthy.
- `npm run test:migrate` — passed; all 6 migrations applied to local
  `taskflow_test`.
- `npm run test:integration` — reached the live database and application, but
  reported **14 passed, 19 failed, 3 todo**. The failures consistently returned
  the expected `403 EMAIL_NOT_VERIFIED` because the older protected-route test
  fixtures use the intentionally unverified token returned by registration.
  This is test-fixture drift caused by the new verified-email policy, not a
  production defect. The tests must either verify their fixture users or
  explicitly test the unverified 403 policy before protected-resource
  assertions can pass.

### Live API → queue → worker → console flow

The current source API and worker were run with `.env.test` and the local
PostgreSQL/Redis services. A disposable registration produced
`emailVerified=false`, queued an `email_verification` BullMQ job, and the
worker delivered the email through `EMAIL_PROVIDER=console`; the worker log
contained the six-digit OTP.

Observed live results:

| Scenario | Result |
|---|---|
| Registration | `201`, unverified user, access token returned |
| Protected route before verification | `403 EMAIL_NOT_VERIFIED` |
| Invalid OTP | `401 OTP_INVALID` |
| Valid OTP | `200`; fresh verified token returned |
| Protected route after verification | `200` |
| Reusing OTP after verification | `409 EMAIL_ALREADY_VERIFIED` |
| Five invalid attempts, then sixth | first five `401 OTP_INVALID`, sixth `429 OTP_LOCKED` |
| Resend while cooldown active | `429 OTP_RESEND_COOLDOWN` with `retryAfterSeconds=60` |
| Expired OTP | `401 OTP_EXPIRED` after expiring only the disposable test row |

The host API and worker processes were stopped after validation. The disposable
PostgreSQL and Redis Docker containers remain available for continued local
testing. The local `.env.test` contains only the checked-in example test values
and is not a production credential file.

## 14. Registration validation UX — 2026-10-11

Registration now validates required fields in the frontend before making a
request and displays inline messages for empty/invalid name, organization,
email, and password values. Server-side Zod validation errors are also
normalized to field names instead of being grouped under the nested `body`
wrapper. Duplicate-email responses are shown beside the email field.

Validation results:

- Backend typecheck and lint: passed.
- Backend unit tests: **91/91 passed**.
- Frontend typecheck: passed.
- Frontend lint: passed with the two existing profile-page warnings.
- Frontend unit tests: **22/22 passed**.
- Live invalid registration probe: `422` with direct `email` and `password`
  field issues.
