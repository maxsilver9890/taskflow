# TaskFlow — Frontend

A Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 frontend for the
[TaskFlow backend](https://github.com/maxsilver9890/taskflow-backend) — a
multi-tenant project-management REST API (Node.js, Express, PostgreSQL,
Prisma, Redis/BullMQ).

This app talks to the backend directly over HTTP using the API's real
endpoints — nothing is mocked. Every request/response shape below was
verified against the backend's route handlers, controllers, services and
Zod schemas, not assumed.

![TaskFlow](https://img.shields.io/badge/status-demo_ready-0b2030)

## Features

- **Auth** — login, registration (creates a new organization), JWT access +
  refresh tokens stored client-side, automatic silent refresh (with
  cross-tab coordination so two tabs never race the rotating refresh token).
- **Dashboard** — org-wide summary tiles, "my tasks", tasks due soon, overdue
  tasks, recent projects.
- **Projects** — list, create, edit, delete (delete is admin-only, matching
  the API's `requireAdmin` middleware), per-project dashboard (task counts
  by status).
- **Tasks** — full CRUD, a drag-and-drop Kanban board (statuses: To do → In
  progress → Review → Done) and a filterable/sortable table view.
  Filters: project, status, priority, assignee, due-date range, an
  "overdue" toggle, all reflected in the URL for shareable links.
- **Assignment** — assign/unassign any org member to/from a task from a
  people picker; shows the notification job that gets queued.
- **Notifications** — the API has no "list jobs" endpoint (a job id only
  ever comes back from `POST /tasks/:id/assign`), so this app remembers job
  ids returned to *this browser* and polls `GET /jobs/:id` for their live
  status (pending → active → completed/failed) until they settle.
- **Loading / empty / error states** everywhere data is fetched, plus toasts
  for mutations.
- **Responsive** — a sidebar + top nav on desktop, a bottom tab bar on
  mobile, and a horizontally-scrollable Kanban board on small screens.
- **Light/dark theme**, keyboard-accessible dialogs and menus (Radix UI).

## What's intentionally *not* here

- **Comments** — the Prisma schema has a `Comment` model, but the backend
  doesn't expose any comment routes/controllers. Rather than invent an
  endpoint, this UI simply doesn't show a comments feature.
- **A "create job" flow** — per the backend's own docs, there is
  intentionally no `POST /jobs`; jobs only exist as a side effect of
  `POST /tasks/:id/assign`.
- **A "list organization members" endpoint** doesn't exist either, so the
  assignee picker is built from everyone who has ever appeared as an
  assignee on a task in the org (plus you). This is a reasonable
  approximation, not a perfect member directory.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 (CSS-variable design tokens, light/dark) |
| Data fetching | TanStack Query v5 |
| Drag & drop | dnd-kit |
| UI primitives | Radix UI (Dialog, Dropdown Menu) |
| Toasts | sonner |
| Icons | lucide-react |
| Tests | Vitest |

## Getting started

### Prerequisites

- Node.js ≥ 20.9
- A running instance of the [TaskFlow backend](https://github.com/maxsilver9890/taskflow-backend)
  — either the public Render deployment or your own (via Docker Compose).

### Install

```bash
npm install
```

### Configure environment variables

Copy `.env.example` to `.env.local` and set the API URL:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Base URL of the TaskFlow API, no trailing slash. Use `http://localhost:3000` for a local backend, or the public Render URL (`https://taskflow-backend-api-7iwy.onrender.com`) for the hosted demo. |
| `NEXT_PUBLIC_DEMO_MODE` | No | `true` to show one-click demo sign-in buttons on the login page, built from the backend's `prisma/seed.ts` accounts. |
| `NEXT_PUBLIC_DEMO_PASSWORD` | No | The seeded demo password, so the demo buttons can autofill it. Never put a real password here. |
| `NEXT_PUBLIC_WORKER_DEPLOYED` | No | `true` only if a BullMQ worker is actually running against the API you're pointing at. When `false` (the default, matching the public Render deployment), the Notifications page explains that jobs will stay `pending` rather than implying something is broken. |

### Run

```bash
npm run dev      # http://localhost:3000 (or 3001 if the backend already owns 3000)
```

If you're running the backend locally on port 3000 too, either run the
backend on a different port or start this app with `-p 3001`:

```bash
npm run dev -- -p 3001
```

### Build & verify

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest
npm run build        # production build
npm start             # serve the production build
```

## Design system

The marketing site and the authenticated app share one visual identity —
navy/cream grounds, a single coral accent, Archivo + IBM Plex Mono — defined
once in `src/app/globals.css` as CSS custom properties (`--canvas`,
`--surface`, `--ink`, `--brand`, status/priority colors, radii, shadows).
Every component in `src/components` reads these tokens rather than a raw
color, so the two surfaces stay visually consistent without duplicating
styles, while each keeps its own register: the marketing page is expressive
(pinned scroll stages, a canvas-drawn star field, per-word reveal
animation — plain CSS custom properties driven by one rAF scroll handler, no
animation library), the app itself stays restrained and information-dense
(tables, filters, dialogs, toasts).

## Project structure

```
src/
  app/
    (marketing)/                         # public marketing site at "/" — product positioning,
                                          # pinned scroll-choreographed sections, own nav/footer
    (auth)/login, (auth)/register        # unauthenticated routes, shared split-screen layout
    (app)/dashboard, projects, tasks,
          notifications                  # authenticated routes, shared app shell
    globals.css                          # shared design tokens (color, type, spacing, shadows) —
                                          # every component below reads these variables, never a
                                          # raw hex, so retheming the whole app is a one-file change
  components/
    layout/     # AppShell (sidebar/topbar/bottom-nav), PageHeader, Logo
    projects/   # ProjectCard, ProjectFormDialog
    tasks/      # KanbanBoard, TaskCard, TaskTable, TaskFilters, TaskFormDialog, AssignDialog
    analytics/  # DashboardStats (project dashboard counts)
    notifications/ # JobRow, JobStatusPill
    ui/         # Button, Input, Select, Badge, Avatar, Dialog, ConfirmDialog,
                # Pagination, DropdownMenu, Skeleton, empty/error states
  hooks/        # useProjects, useTasks, useJobs — thin TanStack Query wrappers
  lib/
    api/        # types.ts (mirrors the backend contract), client.ts (fetch + token refresh),
                # services.ts (one function per endpoint), errors.ts
    auth/       # session storage (localStorage) + AuthProvider (React context)
    job-log.ts  # per-browser log of job ids returned by the assign endpoint
    config.ts, utils.ts, query-keys.ts
```

## How auth works

The backend returns JSON-body JWTs (no cookies), so tokens are kept in
`localStorage` and attached as `Authorization: Bearer <token>` on every
request. Two details worth calling out, both driven by real backend
behavior:

1. **Refresh-token rotation with theft detection.** The backend rotates the
   refresh token on every `/auth/refresh` call and revokes *all* of a
   user's refresh tokens if a stale/already-used one is replayed. The
   client therefore uses a single-flight promise plus a `navigator.locks`
   cross-tab lock around refresh, so two requests (or two tabs) never send
   the same refresh token twice.
2. **Role-based UI.** The access token's JWT payload includes `orgId` and
   `role`. The UI decodes this (without verifying the signature — the API
   remains the sole authority) purely to hide admin-only actions like
   deleting a project, which the backend also enforces server-side via its
   `requireAdmin` middleware.

## API endpoints used

| Method | Path | Used for |
|---|---|---|
| `POST` | `/auth/register` | Sign up (creates org + admin user) |
| `POST` | `/auth/login` | Sign in |
| `POST` | `/auth/refresh` | Silent token refresh |
| `POST` | `/auth/logout` | Revoke refresh token on sign out |
| `GET` | `/projects` | Projects list (paginated) |
| `POST` | `/projects` | Create project |
| `GET` | `/projects/:id` | Project detail |
| `PATCH` | `/projects/:id` | Edit project |
| `DELETE` | `/projects/:id` | Delete project (admin only) |
| `GET` | `/projects/:id/dashboard` | Status-count dashboard |
| `GET` | `/tasks` | Task list — filters: `status`, `priority`, `assignee`, `dueFrom`, `dueTo`, `projectId`, `page`, `limit` |
| `POST` | `/tasks` | Create task |
| `GET` | `/tasks/:id` | Task detail |
| `PATCH` | `/tasks/:id` | Edit task / drag-and-drop status change |
| `DELETE` | `/tasks/:id` | Delete task |
| `POST` | `/tasks/:id/assign` | Assign a user (may return a `jobId`) |
| `DELETE` | `/tasks/:id/assign/:userId` | Unassign a user |
| `GET` | `/jobs/:id` | Poll notification-job status |
| `GET` | `/health` | (available, not currently surfaced in the UI) |

## Deploying

This is a static-friendly Next.js app that can be deployed anywhere Next.js
runs (Vercel, Render, a Node server, etc.). The only required configuration
is `NEXT_PUBLIC_API_URL` pointing at a reachable TaskFlow API — CORS on the
backend is already open, so no proxy is needed.

## Known limitations (by design, matching the current backend)

- The Notifications page will show jobs stuck in `pending` when pointed at
  the public Render API, because Render's free tier doesn't run the BullMQ
  worker — this is the backend's documented, current limitation, not a bug
  in this frontend. Point `NEXT_PUBLIC_API_URL` at a locally-run backend
  (`docker compose up`) to see jobs actually complete.
- There's no "all org members" endpoint, so the assignee picker only shows
  people who've already been assigned to something. Assign yourself or a
  seeded demo user to a first task to "discover" more people.
