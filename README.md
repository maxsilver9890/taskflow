# TaskFlow

TaskFlow is a multi-tenant task and project management application. The workspace contains an Express/TypeScript backend and a Next.js frontend.

## Project Status

| Area | Status | Notes |
| --- | --- | --- |
| Data modeling and database design | Complete | PostgreSQL, Prisma migrations, relationships, indexes, seed data, and organization invitations |
| Authentication and authorization | Complete | JWT access/refresh tokens, refresh-token rotation, multi-organization context, roles, rate limiting, and tenant scoping |
| Projects and tasks API | Complete | CRUD, filters, pagination, assignments, dashboards, comments, and validation |
| Multi-organization management | Complete | Multiple memberships, per-organization roles, switching, invitations, member management, leave/transfer/delete lifecycle |
| Notifications | Complete | Persistent in-app notifications, unread counts, read state, BullMQ/email delivery, retries, and DLQ |
| Frontend workspace UX | Complete | Organization switcher, team management, profile/org management, notification center, and responsive authenticated shell |
| Testing and API documentation | Complete | Unit/integration tests, OpenAPI, Swagger UI, and Postman collection |

## Technology Stack

| Layer | Technology |
| --- | --- |
| Backend | Node.js, TypeScript, Express 5 |
| Frontend | Next.js, React, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Jobs | Redis, BullMQ |
| Validation and security | Zod, JWT, bcrypt, Helmet, CORS, rate limiting |
| Email | Resend (production), console logger (development/test) |
| Testing and tooling | Vitest, Supertest, ESLint, Docker Compose |

## Architecture

```text
Browser
   |
   v
Next.js frontend
   |
   v
Express API
   |
   +--> Authentication and authorization
   +--> Projects and tasks
   +--> Job status
   +--> Prisma ------------------> PostgreSQL
   |
   +--> BullMQ ------------------> Redis
                                      |
                                      v
                                Background worker
                                      |
                                      v
                                Email provider
```

### Repository Layout

```text
taskflow/
|-- taskflow-backend/
|   |-- prisma/                 Database schema, migrations, and seed
|   |-- src/
|   |   |-- auth/               Authentication routes and services
|   |   |-- docs/               OpenAPI document and Swagger UI
|   |   |-- jobs/               Queues, processors, and job status API
|   |   |-- projects/           Project routes and services
|   |   |-- tasks/              Task routes, services, and assignments
|   |   |-- worker/             Background worker entry point
|   |-- tests/                  Unit and integration tests
|   |-- docker-compose.yml      API, worker, PostgreSQL, and Redis
|-- taskflow-frontend/
|   |-- src/app/                Next.js routes and layouts
|   |-- src/components/         Shared UI and feature components
|   |-- src/hooks/              Data-fetching hooks
|   |-- src/lib/                API clients and frontend utilities
```

## Prerequisites

- Node.js 22 or newer
- Docker Desktop with Docker Compose
- npm

## Local Setup

Run backend commands from `taskflow-backend/`.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `taskflow-backend/.env` with values for the local services. At minimum:

```env
POSTGRES_DB=taskflow
POSTGRES_USER=taskflow
POSTGRES_PASSWORD=change_me
DATABASE_URL=postgresql://taskflow:change_me@localhost:5433/taskflow

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=replace_with_a_local_secret
JWT_REFRESH_SECRET=replace_with_a_different_local_secret

# Use console for local development — no external service required
EMAIL_PROVIDER=console
```

Copy `taskflow-backend/.env.example` for a full reference of all available variables. Do not commit real secrets. The development password shown below is for local seeded data only.

### 3. Start PostgreSQL and Redis

```bash
docker compose up -d postgres redis
```

### 4. Apply migrations, generate Prisma Client, and seed data

```bash
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
```

For active schema development, use `npm run prisma:migrate` instead of `prisma migrate deploy`.

### 5. Start the API

```bash
npm run dev
```

The API is available at `http://localhost:3000`.

### 6. Start the frontend

Run these commands from `taskflow-frontend/`:

```bash
npm install
npm run dev
```

The frontend is available at `http://localhost:3001` unless Next.js selects another port.

## Docker Compose

The complete backend stack is available with:

```bash
docker compose up --build
```

| Service | Purpose | Local address |
| --- | --- | --- |
| `api` | Express HTTP API | `http://localhost:3000` |
| `worker` | BullMQ email processor | No public port |
| `postgres` | Application database | `localhost:5433` |
| `redis` | Queue backend | `localhost:6379` |

The API and worker wait for PostgreSQL and Redis health checks before starting. Containers use `postgres:5432` and `redis:6379`; host-side commands use `localhost:5433` and `localhost:6379`.

## Database

Prisma manages the PostgreSQL schema. The main tables are:

| Domain | Tables |
| --- | --- |
| Identity and tenancy | `users`, `organizations`, `org_members`, `refresh_tokens`, `organization_invitations` |
| Work management | `projects`, `tasks`, `task_assignments`, `comments` |
| Notifications | `notifications` |

The schema also defines PostgreSQL enums for task status, task priority, and organization membership roles.

Seed data includes 2 organizations, 5 users, 5 memberships, 4 projects, 12 tasks, assignments, and comments.

```bash
npx prisma migrate status
npx prisma studio
```

Prisma Studio runs at `http://localhost:5555`.

### Development Credentials

Seeded users use:

```text
Password: TaskFlowDemo123!
```

Passwords are stored as bcrypt hashes with a cost factor of 12 or higher.

## API Overview

All protected endpoints require:

```http
Authorization: Bearer <access_token>
```

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Create a user, organization, membership, and tokens |
| `POST` | `/auth/login` | Authenticate with email and password |
| `POST` | `/auth/refresh` | Rotate a refresh token and issue a new access token |
| `POST` | `/auth/logout` | Revoke a refresh token |
| `POST` | `/auth/select-org` | Issue a new session for a selected organization membership |
| `POST` | `/auth/verify-email` | Redeem a 6-digit OTP and mark the caller's email verified |
| `POST` | `/auth/resend-verification` | Generate and queue a new OTP, invalidating the previous one |

Access tokens expire after 15 minutes by default. Refresh tokens are persisted as SHA-256 hashes, expire after 7 days by default, and cannot be replayed after rotation or revocation. Authentication endpoints are limited to 10 requests per minute per IP.

#### Email verification

Registration creates the account, logs the user in (as before), and immediately queues a 6-digit one-time code through the existing BullMQ email infrastructure — there is no separate email system. The account is **unverified** until that code is redeemed:

* **Access policy.** `emailVerified` is embedded directly in the access token's JWT claims at issue time, so `requireVerifiedEmail` can gate every other authenticated route (`/projects`, `/tasks`, `/comments`, `/organizations`, `/users`, `/notifications`, `/jobs`) with zero extra DB lookups per request, returning `403 EMAIL_NOT_VERIFIED`. `POST /auth/verify-email`, `POST /auth/resend-verification`, and `POST /auth/logout` are deliberately exempt — a freshly-registered, unverified user must still be able to reach them. Login and refresh are also unaffected: an unverified user can still obtain tokens, they just can't use the rest of the product until they verify.
* **OTP storage and lifecycle.** Only a SHA-256 hash of the code is ever persisted (`EmailVerificationOtp.otpHash`, mirroring `RefreshToken`/`PasswordResetToken`). Codes are generated with `crypto.randomInt` (CSPRNG), expire after **10 minutes**, are single-use (`consumedAt`), and generating a new one immediately invalidates whatever was active before it (`invalidatedAt`) — only the most recently issued code is ever redeemable.
* **Brute-force protection.** Each code locks out after **5** incorrect attempts (`attempts` on the active row); the account owner must request a new code to keep trying. Verification is compared with `crypto.timingSafeEqual` rather than a plain string/`===` comparison. `POST /auth/resend-verification` additionally enforces a **60-second** per-user cooldown on top of the router-wide 10 req/min/IP limiter already applied to all of `/auth/*`.
* **No enumeration surface.** Both endpoints are authenticated (`Authorization: Bearer`) and act on `req.auth.userId` — there is no email-in-body variant, so a caller can only ever verify or resend for their own account, and "wrong code", "no code was ever issued", and "code already used" all return the identical `401 OTP_INVALID` so a caller learns nothing about internal state. The OTP itself is never returned by any endpoint, logged, or placed in a URL — the console email provider printing it to stdout in dev is the simulated email send, not an application log.
* **On success**, `POST /auth/verify-email` returns a *new* access/refresh pair with `emailVerified: true` already baked in, so the client can proceed into the app immediately instead of waiting out its old (≤15 min) access token.
* **Existing accounts.** The migration that adds this feature backfills every pre-existing user to `emailVerified = true` (stamped with their original `createdAt`) — there's no OTP they could ever have confirmed, so nobody already using the product is locked out retroactively. Only accounts created after the migration start out unverified.

### Organizations and Memberships

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/users/me/organizations` | List all organizations and the authenticated user's role in each |
| `POST` | `/organizations` | Create an organization; creator becomes `ORG_ADMIN` |
| `GET` | `/organizations/me` | Get the currently active organization |
| `GET` | `/organizations/me/members` | List members of the active organization |
| `POST` | `/auth/select-org` | Switch the active organization context |
| `POST` | `/organizations/me/invitations` | Invite a user to the active organization |
| `GET` | `/organizations/me/invitations` | List pending invitations |
| `DELETE` | `/organizations/me/invitations/:id` | Cancel an invitation |
| `POST` | `/organizations/invitations/:token/accept` | Accept an organization invitation |
| `POST` | `/organizations/invitations/accept` | Accept an invitation using a token in the request body |
| `PATCH` | `/organizations/me/members/:userId` | Change a member's role |
| `DELETE` | `/organizations/me/members/:userId` | Remove a member |
| `DELETE` | `/organizations/me/membership` | Leave the active organization |
| `POST` | `/organizations/me/transfer-admin` | Transfer admin role to another member |
| `DELETE` | `/organizations/me` | Delete the active organization |

Organization roles are stored on `OrgMember`, so a user can have different roles in different organizations. The active organization is represented by the authenticated `orgId`/`role` context. Admin operations are revalidated against the current organization's membership.

The organization lifecycle protects against leaving an organization with members but no administrator. A last admin must transfer admin rights or delete the organization. Deleting an organization does not delete users or their memberships in other organizations.

### Notifications

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/notifications` | Get the authenticated user's notifications and server-derived unread count |
| `PATCH` | `/notifications/:id/read` | Mark one notification as read |
| `POST` | `/notifications/read-all` | Mark all notifications as read |

Notifications are persisted in PostgreSQL. The authenticated frontend displays the unread count in the top-right notification bell and supports individual and mark-all read actions.

### Projects and Tasks

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/projects` | Create a project |
| `GET` | `/projects` | List organization projects |
| `GET` | `/projects/:id` | Get a project |
| `PATCH` | `/projects/:id` | Update a project |
| `DELETE` | `/projects/:id` | Delete a project |
| `GET` | `/projects/:id/dashboard` | Get task counts by status |
| `POST` | `/tasks` | Create a task |
| `GET` | `/tasks` | List organization tasks |
| `GET` | `/tasks/:id` | Get a task |
| `PATCH` | `/tasks/:id` | Update a task |
| `DELETE` | `/tasks/:id` | Delete a task |
| `POST` | `/tasks/:id/assign` | Assign a task to an organization member |
| `DELETE` | `/tasks/:id/assign/:userId` | Remove a task assignment |

Task listing supports `status`, `priority`, `assignee`, `dueFrom`, `dueTo`, and `projectId` filters, plus offset pagination:

```text
GET /tasks?page=1&limit=20
```

Paginated responses have this shape:

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

Validation uses Zod. Errors use a consistent shape:

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {}
}
```

### Job Status and API Documentation

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/jobs/:id` | Get an organization-scoped job status |
| `GET` | `/health` | Check API and Redis health |
| `GET` | `/api-docs` | Open Swagger UI |
| `GET` | `/api-docs/openapi.json` | Download the OpenAPI document |

Swagger UI is available at `http://localhost:3000/api-docs`.

## Background Jobs

Task assignment persists the database record before attempting to enqueue an email job:

```text
POST /tasks/:id/assign
        |
        v
Insert task_assignments in PostgreSQL
        |
        v
Add task_assigned job to Redis/BullMQ
        |
        v
Return 201 with assignment and optional jobId
        |
        v
Worker -> email.processor.ts -> email provider
```

### Queue Topology

| Queue | Purpose |
| --- | --- |
| `taskflow-email` | Main assignment-notification queue |
| `taskflow-email-dlq` | Explicit dead-letter queue for exhausted jobs |

Jobs have 3 attempts with exponential backoff: 1 second, 2 seconds, then 4 seconds. Failed jobs remain queryable in the main queue. After the final failure, the worker copies the original job ID, payload, attempt count, and failure reason to the DLQ. DLQ entries are not retried automatically.

Every job payload includes `organizationId`, which is derived from the authenticated request. Job status requests compare that value with the caller's organization before returning metadata; cross-tenant probes return `403 Forbidden`.

If database persistence succeeds but queue enqueueing fails, the assignment remains and the API returns `201` without a `jobId`. The enqueue failure is logged at warning level. This persist-first strategy avoids phantom assignments while accepting that a notification may be missed during a temporary Redis outage.

## Email Provider

TaskFlow uses a provider abstraction so the email transport can be changed without touching the queue or worker code.

| `EMAIL_PROVIDER` | Description |
| --- | --- |
| `console` (default) | Logs email payloads as structured JSON to stdout. No external service required. Use for local development and tests. |
| `resend` | Sends real emails through the [Resend](https://resend.com) API. Use for staging and production. |

### Configuring Resend for production

1. Create a free account at [resend.com](https://resend.com).
2. Verify your sending domain in the Resend dashboard.
3. Create an API key.
4. Set the following environment variables:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_ADDRESS=TaskFlow <noreply@yourdomain.com>
```

Emails are never sent synchronously from the API. All delivery goes through the BullMQ queue and the background worker, which retries failed sends up to 3 times with exponential backoff before forwarding the job to the DLQ.

All three email types include a plain-text fallback and a styled HTML body:
- **Task assignment** — sent when a task is assigned to a user
- **Password reset** — sent when a password-reset is requested
- **Organization invitation** — sent when a user is invited to an organization

### Testing with a real provider

If `RESEND_API_KEY` and `RESEND_FROM_ADDRESS` are available locally, set `EMAIL_PROVIDER=resend` in `.env` and assign a task. The worker will deliver a real email. Check the Resend dashboard for delivery status and logs.

## Testing

Tests use a separate database and must never target the development database.

### One-time test database setup

```bash
docker compose up -d postgres redis
docker compose exec postgres psql -U taskflow -d taskflow -c "CREATE DATABASE taskflow_test;"
```

Create `.env.test` from `.env.test.example`, then run:

```bash
npm run test:migrate
npm test
```

All test scripts load `.env.test` automatically through `dotenv-cli`:

```bash
npm run test:unit
npm run test:integration
npm run test:watch
npm run test:coverage
```

Integration tests exercise the HTTP app against the isolated database and reset data between tests. CI runs the same suite against fresh PostgreSQL and Redis service containers.

## Useful Commands

| Command | Purpose |
| --- | --- |
| `npm run build` | Compile the backend |
| `npm run typecheck` | Run TypeScript checks without emitting files |
| `npm run lint` | Run ESLint |
| `npm run dev` | Start the API with file watching |
| `npm run worker:dev` | Start the worker with file watching |
| `npm run worker` | Start the compiled worker |
| `npx prisma studio` | Open the database browser |

## Security and Tenant Assumptions

- Registration creates a new organization and assigns the registering user the `ORG_ADMIN` role.
- Supported roles are `ORG_ADMIN` and `MEMBER`.
- A user can belong to multiple organizations and can have a different role in each organization.
- Authenticated context contains `userId`, `orgId`, and `role` for the active organization.
- Organization switching verifies the exact `OrgMember` relationship before issuing a new session context.
- Refresh tokens preserve the selected organization context and re-check the current membership/role.
- Project, task, assignment, member, and job queries are scoped by the authenticated organization.
- Client-supplied organization IDs are not used as the authorization source for protected organization operations.
- Admin-only organization operations revalidate the caller's membership and role against the database.
- Last-admin protection prevents an organization with remaining members from being left without an administrator.
- Organization deletion does not delete users or their memberships in other organizations.
- Refresh tokens are hashed and rotated; revoked tokens cannot be reused.
- Logout revokes the refresh token. Existing access tokens remain valid until their short TTL expires.
- Notification reads and unread counts are scoped to the authenticated user.

## Current Frontend Workspace Features

The authenticated frontend currently provides:

- Dashboard, projects, tasks, and team views
- Multi-organization switcher in the authenticated header
- Profile editing and password change
- Organizations list with per-organization role
- Organization creation
- Organization leave, admin transfer, and deletion flows
- Organization invitations, role changes, member removal, and pending invitation management
- Top-right notification bell with server-backed unread count
- Individual and mark-all notification read actions
- Organization-scoped React Query invalidation/refetching after organization switches and mutations

The notification count is persisted/server-derived rather than based only on browser-local state.

## Current Scope

The current implementation is focused on the core multi-tenant work-management foundation: secure organization context, project/task management, reliable background jobs, persistent notifications, and the authenticated SaaS workspace experience.

The following are intentionally not implied as complete unless explicitly listed above: predictive project intelligence, AI assistant/actions, advanced audit/session management, and richer organization invitation flows such as unauthenticated registration-plus-invite acceptance.

## API Collections

The Postman collection is available at:

```text
taskflow-backend/postman/TaskFlow.postman_collection.json
```
