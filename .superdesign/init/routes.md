# TaskFlow Routes

Next.js App Router. Parentheses indicate route groups and are not part of the URL.

| URL | Route file | Layout | Purpose |
|---|---|---|---|
| / | src/app/(marketing)/page.tsx | marketing | Product landing page and feature/architecture overview |
| /login | src/app/(auth)/login/page.tsx | auth | Login, email verification recovery, and secure Firebase account-link recovery |
| /register | src/app/(auth)/register/page.tsx | auth | Create a TaskFlow user and a new organization |
| /forgot-password | src/app/(auth)/forgot-password/page.tsx | auth | Request a password reset |
| /reset-password | src/app/(auth)/reset-password/page.tsx | auth | Set a new password from a reset link |
| /verify-email | src/app/(auth)/verify-email/page.tsx | auth | Verify email and continue safe next redirects |
| /dashboard | src/app/(app)/dashboard/page.tsx | app | Overview of projects and tasks |
| /projects | src/app/(app)/projects/page.tsx | app | Browse and manage organization projects |
| /projects/[projectId] | src/app/(app)/projects/[projectId]/page.tsx | app | Project details, metrics, and kanban tasks |
| /tasks | src/app/(app)/tasks/page.tsx | app | Search, filter, paginate, and manage tasks |
| /tasks/[taskId] | src/app/(app)/tasks/[taskId]/page.tsx | app | Task details, assignment, status, and comments |
| /team | src/app/(app)/team/page.tsx | app | Organization members, roles, and invitations |
| /notifications | src/app/(app)/notifications/page.tsx | app | In-app notifications and queued delivery status |
| /profile | src/app/(app)/profile/page.tsx | app | User profile and account settings |
| /invitations/[token] | src/app/invitations/[token]/page.tsx | root | Public invitation lookup and authenticated accept/reject |
| Not found | src/app/not-found.tsx | root | 404 experience |

Routing is filesystem-based; no separate route configuration file exists. Shared route wrappers are src/app/layout.tsx, src/app/(auth)/layout.tsx, src/app/(marketing)/layout.tsx, and src/app/(app)/layout.tsx. The application shell is src/components/layout/AppShell.tsx.