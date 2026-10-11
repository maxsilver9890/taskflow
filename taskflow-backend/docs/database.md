# Database Design

## Schema overview

Stage 2 adds the normalized PostgreSQL data model for TaskFlow using Prisma migrations. The schema includes seven required tables:

- `users`
- `organizations`
- `org_members`
- `projects`
- `tasks`
- `task_assignments`
- `comments`

The design keeps tenant ownership explicit through organizations and projects, while leaving authentication, RBAC, CRUD APIs, and background jobs for later stages.

## Table descriptions

- `users`: application users with unique email addresses and stored password hashes for future authentication work.
- `organizations`: tenant records that own projects and membership rows.
- `org_members`: join table linking users to organizations with an organization-scoped role.
- `projects`: organization-owned workspaces that group related tasks.
- `tasks`: project-owned work items with status, priority, optional due date, and timestamps.
- `task_assignments`: join table linking tasks to assigned users.
- `comments`: task discussion records with author attribution.

## Relationship explanation

- An organization has many projects.
- An organization has many members through `org_members`.
- A user can belong to many organizations through `org_members`.
- A project belongs to one organization.
- A project has many tasks.
- A task can have many assignees through `task_assignments`.
- A task can have many comments.
- A comment belongs to one task and one authoring user.

## Enum explanation

PostgreSQL enums used in this stage:

- `status`: `todo`, `in_progress`, `review`, `done`
- `priority`: `low`, `medium`, `high`, `urgent`
- `org_member_role`: `org_admin`, `member`

## Primary keys

- `users.id`: UUID primary key
- `organizations.id`: UUID primary key
- `projects.id`: UUID primary key
- `tasks.id`: UUID primary key
- `comments.id`: UUID primary key
- `org_members (organizationId, userId)`: composite primary key
- `task_assignments (taskId, userId)`: composite primary key

## Unique constraints

- `users.email` is unique to support future login and identity lookup.
- `org_members (organizationId, userId)` prevents duplicate membership rows for the same user in the same organization.
- `task_assignments (taskId, userId)` prevents duplicate assignment of the same user to the same task.

## Foreign key behavior

The schema does not rely on Prisma defaults blindly. The following on-delete behavior is chosen intentionally:

- `organizations -> projects`: `RESTRICT`
- `projects -> tasks`: `CASCADE`
- `tasks -> task_assignments`: `CASCADE`
- `tasks -> comments`: `CASCADE`
- `users -> task_assignments`: `RESTRICT`
- `users -> comments`: `RESTRICT`
- `organizations -> org_members`: `CASCADE`
- `users -> org_members`: `CASCADE`

All relations use `CASCADE` on update to keep foreign keys aligned if an identifier ever changes, even though UUID primary keys are expected to be stable.

## CASCADE decisions

- `projects -> tasks`: if a project is removed intentionally, its tasks should not survive without a parent project.
- `tasks -> task_assignments`: assignments are meaningless without their task.
- `tasks -> comments`: comments are part of a task discussion thread and should disappear with the task.
- `organizations -> org_members`: membership rows should not remain after an organization is deleted.
- `users -> org_members`: memberships should not orphan if a user is removed from the system.

## RESTRICT decisions

- `organizations -> projects`: prevents accidental organization deletion while project data still exists.
- `users -> task_assignments`: preserves historical assignment relationships unless assignments are explicitly cleaned up first.
- `users -> comments`: protects authored discussion history and forces deliberate cleanup before deleting a user.

## Index rationale

Important indexes are tied to expected query patterns rather than added blindly:

- `users.email` unique index: supports login lookup and duplicate prevention.
- `org_members.organizationId`: supports listing all members for a tenant.
- `org_members.userId`: supports finding every organization a user belongs to.
- `projects.organizationId`: supports tenant-scoped project listing.
- `tasks.projectId`: supports fetching all tasks for a project.
- `tasks (projectId, status)`: supports kanban and backlog views filtered by status inside a project.
- `tasks (projectId, priority)`: supports priority sorting and triage in project views.
- `tasks.dueDate`: supports overdue and calendar-style queries.
- `task_assignments.taskId`: supports resolving assignees for a task.
- `task_assignments.userId`: supports later “my work” and assignee filtering.
- `comments.taskId`: supports loading a task’s comment thread efficiently.

## Migration strategy

The database is managed exclusively through Prisma migrations:

- author schema in `prisma/schema.prisma`
- generate the Prisma client
- create the initial migration with `prisma migrate dev`
- apply in non-development environments with `prisma migrate deploy`

There is no manually maintained `schema.sql` file.

## Seed strategy

The seed script is deterministic and creates:

- 2 organizations
- 5 users
- multiple projects across both organizations
- 12 tasks across multiple projects
- task assignments
- sample comments

The seed uses fixed UUIDs so demo data is stable across environments. Passwords are stored as bcrypt-compatible hashes, but no authentication logic is implemented in this stage.

## Deliberately deferred bonus features

The following are intentionally not implemented in Stage 2:

- authentication and JWT handling
- authorization and tenant access control
- CRUD APIs
- BullMQ jobs
- soft delete
- PostgreSQL full-text search
