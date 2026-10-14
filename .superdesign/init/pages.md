# TaskFlow Page Dependency Trees

Each entry lists the route entry and recursively traced local imports. Shared app/root layouts are listed first. External packages are omitted.

## /

Entry: taskflow-frontend/src/app/(marketing)/page.tsx
Dependencies:
- taskflow-frontend/src/app/layout.tsx
  - taskflow-frontend/src/lib/Providers.tsx
    - taskflow-frontend/src/lib/api/errors.ts
      - taskflow-frontend/src/lib/api/types.ts
    - taskflow-frontend/src/lib/auth/AuthProvider.tsx
      - taskflow-frontend/src/lib/api/services.ts
        - taskflow-frontend/src/lib/api/client.ts
          - taskflow-frontend/src/lib/config.ts
          - taskflow-frontend/src/lib/auth/session.ts
      - taskflow-frontend/src/lib/firebase.ts
      - taskflow-frontend/src/lib/navigation.ts
- taskflow-frontend/src/app/(marketing)/layout.tsx
- taskflow-frontend/src/app/(marketing)/page.tsx

## /dashboard

Entry: taskflow-frontend/src/app/(app)/dashboard/page.tsx
Dependencies:
- taskflow-frontend/src/app/layout.tsx
  - taskflow-frontend/src/lib/Providers.tsx
    - taskflow-frontend/src/lib/api/errors.ts
      - taskflow-frontend/src/lib/api/types.ts
    - taskflow-frontend/src/lib/auth/AuthProvider.tsx
      - taskflow-frontend/src/lib/api/services.ts
        - taskflow-frontend/src/lib/api/client.ts
          - taskflow-frontend/src/lib/config.ts
          - taskflow-frontend/src/lib/auth/session.ts
      - taskflow-frontend/src/lib/firebase.ts
      - taskflow-frontend/src/lib/navigation.ts
- taskflow-frontend/src/app/(app)/layout.tsx
  - taskflow-frontend/src/components/layout/AppShell.tsx
    - taskflow-frontend/src/components/ui/Avatar.tsx
      - taskflow-frontend/src/lib/utils.ts
    - taskflow-frontend/src/components/ui/DropdownMenu.tsx
    - taskflow-frontend/src/hooks/use-organization.ts
      - taskflow-frontend/src/lib/query-keys.ts
    - taskflow-frontend/src/components/layout/Logo.tsx
- taskflow-frontend/src/app/(app)/dashboard/page.tsx
  - taskflow-frontend/src/components/layout/PageHeader.tsx
    - taskflow-frontend/src/hooks/use-scroll-reveal.ts
  - taskflow-frontend/src/components/projects/ProjectFormDialog.tsx
    - taskflow-frontend/src/components/ui/Button.tsx
    - taskflow-frontend/src/components/ui/Dialog.tsx
    - taskflow-frontend/src/components/ui/Input.tsx
    - taskflow-frontend/src/hooks/use-projects.ts
  - taskflow-frontend/src/components/tasks/TaskFormDialog.tsx
    - taskflow-frontend/src/components/ui/Select.tsx
    - taskflow-frontend/src/hooks/use-tasks.ts
      - taskflow-frontend/src/lib/job-log.ts
  - taskflow-frontend/src/components/ui/Badge.tsx
  - taskflow-frontend/src/components/ui/Skeleton.tsx
  - taskflow-frontend/src/components/ui/States.tsx

## /projects

Entry: taskflow-frontend/src/app/(app)/projects/page.tsx
Dependencies:
- taskflow-frontend/src/app/layout.tsx
  - taskflow-frontend/src/lib/Providers.tsx
    - taskflow-frontend/src/lib/api/errors.ts
      - taskflow-frontend/src/lib/api/types.ts
    - taskflow-frontend/src/lib/auth/AuthProvider.tsx
      - taskflow-frontend/src/lib/api/services.ts
        - taskflow-frontend/src/lib/api/client.ts
          - taskflow-frontend/src/lib/config.ts
          - taskflow-frontend/src/lib/auth/session.ts
      - taskflow-frontend/src/lib/firebase.ts
      - taskflow-frontend/src/lib/navigation.ts
- taskflow-frontend/src/app/(app)/layout.tsx
  - taskflow-frontend/src/components/layout/AppShell.tsx
    - taskflow-frontend/src/components/ui/Avatar.tsx
      - taskflow-frontend/src/lib/utils.ts
    - taskflow-frontend/src/components/ui/DropdownMenu.tsx
    - taskflow-frontend/src/hooks/use-organization.ts
      - taskflow-frontend/src/lib/query-keys.ts
    - taskflow-frontend/src/components/layout/Logo.tsx
- taskflow-frontend/src/app/(app)/projects/page.tsx
  - taskflow-frontend/src/components/layout/PageHeader.tsx
    - taskflow-frontend/src/hooks/use-scroll-reveal.ts
  - taskflow-frontend/src/components/projects/ProjectFormDialog.tsx
    - taskflow-frontend/src/components/ui/Button.tsx
    - taskflow-frontend/src/components/ui/Dialog.tsx
    - taskflow-frontend/src/components/ui/Input.tsx
    - taskflow-frontend/src/hooks/use-projects.ts
  - taskflow-frontend/src/components/projects/ProjectCard.tsx
  - taskflow-frontend/src/components/ui/ConfirmDialog.tsx
  - taskflow-frontend/src/components/ui/Skeleton.tsx
  - taskflow-frontend/src/components/ui/States.tsx
  - taskflow-frontend/src/components/ui/Pagination.tsx

## /projects/[projectId]

Entry: taskflow-frontend/src/app/(app)/projects/[projectId]/page.tsx
Dependencies:
- taskflow-frontend/src/app/layout.tsx
  - taskflow-frontend/src/lib/Providers.tsx
    - taskflow-frontend/src/lib/api/errors.ts
      - taskflow-frontend/src/lib/api/types.ts
    - taskflow-frontend/src/lib/auth/AuthProvider.tsx
      - taskflow-frontend/src/lib/api/services.ts
        - taskflow-frontend/src/lib/api/client.ts
          - taskflow-frontend/src/lib/config.ts
          - taskflow-frontend/src/lib/auth/session.ts
      - taskflow-frontend/src/lib/firebase.ts
      - taskflow-frontend/src/lib/navigation.ts
- taskflow-frontend/src/app/(app)/layout.tsx
  - taskflow-frontend/src/components/layout/AppShell.tsx
    - taskflow-frontend/src/components/ui/Avatar.tsx
      - taskflow-frontend/src/lib/utils.ts
    - taskflow-frontend/src/components/ui/DropdownMenu.tsx
    - taskflow-frontend/src/hooks/use-organization.ts
      - taskflow-frontend/src/lib/query-keys.ts
    - taskflow-frontend/src/components/layout/Logo.tsx
- taskflow-frontend/src/app/(app)/projects/[projectId]/page.tsx
  - taskflow-frontend/src/components/analytics/DashboardStats.tsx
  - taskflow-frontend/src/components/layout/PageHeader.tsx
    - taskflow-frontend/src/hooks/use-scroll-reveal.ts
  - taskflow-frontend/src/components/projects/ProjectFormDialog.tsx
    - taskflow-frontend/src/components/ui/Button.tsx
    - taskflow-frontend/src/components/ui/Dialog.tsx
    - taskflow-frontend/src/components/ui/Input.tsx
    - taskflow-frontend/src/hooks/use-projects.ts
  - taskflow-frontend/src/components/tasks/AssignDialog.tsx
    - taskflow-frontend/src/hooks/use-tasks.ts
      - taskflow-frontend/src/lib/job-log.ts
  - taskflow-frontend/src/components/tasks/KanbanBoard.tsx
    - taskflow-frontend/src/components/ui/ConfirmDialog.tsx
    - taskflow-frontend/src/components/tasks/TaskCard.tsx
      - taskflow-frontend/src/components/ui/Badge.tsx
  - taskflow-frontend/src/components/tasks/TaskFormDialog.tsx
    - taskflow-frontend/src/components/ui/Select.tsx
  - taskflow-frontend/src/components/ui/Skeleton.tsx
  - taskflow-frontend/src/components/ui/States.tsx

## /tasks

Entry: taskflow-frontend/src/app/(app)/tasks/page.tsx
Dependencies:
- taskflow-frontend/src/app/layout.tsx
  - taskflow-frontend/src/lib/Providers.tsx
    - taskflow-frontend/src/lib/api/errors.ts
      - taskflow-frontend/src/lib/api/types.ts
    - taskflow-frontend/src/lib/auth/AuthProvider.tsx
      - taskflow-frontend/src/lib/api/services.ts
        - taskflow-frontend/src/lib/api/client.ts
          - taskflow-frontend/src/lib/config.ts
          - taskflow-frontend/src/lib/auth/session.ts
      - taskflow-frontend/src/lib/firebase.ts
      - taskflow-frontend/src/lib/navigation.ts
- taskflow-frontend/src/app/(app)/layout.tsx
  - taskflow-frontend/src/components/layout/AppShell.tsx
    - taskflow-frontend/src/components/ui/Avatar.tsx
      - taskflow-frontend/src/lib/utils.ts
    - taskflow-frontend/src/components/ui/DropdownMenu.tsx
    - taskflow-frontend/src/hooks/use-organization.ts
      - taskflow-frontend/src/lib/query-keys.ts
    - taskflow-frontend/src/components/layout/Logo.tsx
- taskflow-frontend/src/app/(app)/tasks/page.tsx
  - taskflow-frontend/src/components/layout/PageHeader.tsx
    - taskflow-frontend/src/hooks/use-scroll-reveal.ts
  - taskflow-frontend/src/components/tasks/AssignDialog.tsx
    - taskflow-frontend/src/components/ui/Button.tsx
    - taskflow-frontend/src/components/ui/Dialog.tsx
    - taskflow-frontend/src/components/ui/Input.tsx
    - taskflow-frontend/src/hooks/use-tasks.ts
      - taskflow-frontend/src/lib/job-log.ts
  - taskflow-frontend/src/components/tasks/TaskFilters.tsx
    - taskflow-frontend/src/components/ui/Select.tsx
  - taskflow-frontend/src/components/tasks/TaskFormDialog.tsx
    - taskflow-frontend/src/hooks/use-projects.ts
  - taskflow-frontend/src/components/tasks/TaskTable.tsx
    - taskflow-frontend/src/components/ui/Badge.tsx
    - taskflow-frontend/src/components/ui/Skeleton.tsx
  - taskflow-frontend/src/components/ui/ConfirmDialog.tsx
  - taskflow-frontend/src/components/ui/Pagination.tsx
  - taskflow-frontend/src/components/ui/States.tsx

## /tasks/[taskId]

Entry: taskflow-frontend/src/app/(app)/tasks/[taskId]/page.tsx
Dependencies:
- taskflow-frontend/src/app/layout.tsx
  - taskflow-frontend/src/lib/Providers.tsx
    - taskflow-frontend/src/lib/api/errors.ts
      - taskflow-frontend/src/lib/api/types.ts
    - taskflow-frontend/src/lib/auth/AuthProvider.tsx
      - taskflow-frontend/src/lib/api/services.ts
        - taskflow-frontend/src/lib/api/client.ts
          - taskflow-frontend/src/lib/config.ts
          - taskflow-frontend/src/lib/auth/session.ts
      - taskflow-frontend/src/lib/firebase.ts
      - taskflow-frontend/src/lib/navigation.ts
- taskflow-frontend/src/app/(app)/layout.tsx
  - taskflow-frontend/src/components/layout/AppShell.tsx
    - taskflow-frontend/src/components/ui/Avatar.tsx
      - taskflow-frontend/src/lib/utils.ts
    - taskflow-frontend/src/components/ui/DropdownMenu.tsx
    - taskflow-frontend/src/hooks/use-organization.ts
      - taskflow-frontend/src/lib/query-keys.ts
    - taskflow-frontend/src/components/layout/Logo.tsx
- taskflow-frontend/src/app/(app)/tasks/[taskId]/page.tsx
  - taskflow-frontend/src/components/layout/PageHeader.tsx
    - taskflow-frontend/src/hooks/use-scroll-reveal.ts
  - taskflow-frontend/src/components/tasks/AssignDialog.tsx
    - taskflow-frontend/src/components/ui/Button.tsx
    - taskflow-frontend/src/components/ui/Dialog.tsx
    - taskflow-frontend/src/components/ui/Input.tsx
    - taskflow-frontend/src/hooks/use-tasks.ts
      - taskflow-frontend/src/lib/job-log.ts
  - taskflow-frontend/src/components/tasks/CommentsSection.tsx
    - taskflow-frontend/src/components/ui/ConfirmDialog.tsx
    - taskflow-frontend/src/components/ui/Skeleton.tsx
    - taskflow-frontend/src/components/ui/States.tsx
    - taskflow-frontend/src/hooks/use-comments.ts
  - taskflow-frontend/src/components/tasks/TaskFormDialog.tsx
    - taskflow-frontend/src/components/ui/Select.tsx
    - taskflow-frontend/src/hooks/use-projects.ts
  - taskflow-frontend/src/components/ui/Badge.tsx

## /team

Entry: taskflow-frontend/src/app/(app)/team/page.tsx
Dependencies:
- taskflow-frontend/src/app/layout.tsx
  - taskflow-frontend/src/lib/Providers.tsx
    - taskflow-frontend/src/lib/api/errors.ts
      - taskflow-frontend/src/lib/api/types.ts
    - taskflow-frontend/src/lib/auth/AuthProvider.tsx
      - taskflow-frontend/src/lib/api/services.ts
        - taskflow-frontend/src/lib/api/client.ts
          - taskflow-frontend/src/lib/config.ts
          - taskflow-frontend/src/lib/auth/session.ts
      - taskflow-frontend/src/lib/firebase.ts
      - taskflow-frontend/src/lib/navigation.ts
- taskflow-frontend/src/app/(app)/layout.tsx
  - taskflow-frontend/src/components/layout/AppShell.tsx
    - taskflow-frontend/src/components/ui/Avatar.tsx
      - taskflow-frontend/src/lib/utils.ts
    - taskflow-frontend/src/components/ui/DropdownMenu.tsx
    - taskflow-frontend/src/hooks/use-organization.ts
      - taskflow-frontend/src/lib/query-keys.ts
    - taskflow-frontend/src/components/layout/Logo.tsx
- taskflow-frontend/src/app/(app)/team/page.tsx
  - taskflow-frontend/src/components/layout/PageHeader.tsx
    - taskflow-frontend/src/hooks/use-scroll-reveal.ts
  - taskflow-frontend/src/components/ui/Button.tsx
  - taskflow-frontend/src/components/ui/Dialog.tsx
  - taskflow-frontend/src/components/ui/Input.tsx
  - taskflow-frontend/src/components/ui/Skeleton.tsx
  - taskflow-frontend/src/components/ui/States.tsx

## /notifications

Entry: taskflow-frontend/src/app/(app)/notifications/page.tsx
Dependencies:
- taskflow-frontend/src/app/layout.tsx
  - taskflow-frontend/src/lib/Providers.tsx
    - taskflow-frontend/src/lib/api/errors.ts
      - taskflow-frontend/src/lib/api/types.ts
    - taskflow-frontend/src/lib/auth/AuthProvider.tsx
      - taskflow-frontend/src/lib/api/services.ts
        - taskflow-frontend/src/lib/api/client.ts
          - taskflow-frontend/src/lib/config.ts
          - taskflow-frontend/src/lib/auth/session.ts
      - taskflow-frontend/src/lib/firebase.ts
      - taskflow-frontend/src/lib/navigation.ts
- taskflow-frontend/src/app/(app)/layout.tsx
  - taskflow-frontend/src/components/layout/AppShell.tsx
    - taskflow-frontend/src/components/ui/Avatar.tsx
      - taskflow-frontend/src/lib/utils.ts
    - taskflow-frontend/src/components/ui/DropdownMenu.tsx
    - taskflow-frontend/src/hooks/use-organization.ts
      - taskflow-frontend/src/lib/query-keys.ts
    - taskflow-frontend/src/components/layout/Logo.tsx
- taskflow-frontend/src/app/(app)/notifications/page.tsx
  - taskflow-frontend/src/components/layout/PageHeader.tsx
    - taskflow-frontend/src/hooks/use-scroll-reveal.ts
  - taskflow-frontend/src/components/ui/States.tsx
    - taskflow-frontend/src/components/ui/Button.tsx
  - taskflow-frontend/src/components/ui/Skeleton.tsx

## /login

Entry: taskflow-frontend/src/app/(auth)/login/page.tsx
Dependencies:
- taskflow-frontend/src/app/layout.tsx
  - taskflow-frontend/src/lib/Providers.tsx
    - taskflow-frontend/src/lib/api/errors.ts
      - taskflow-frontend/src/lib/api/types.ts
    - taskflow-frontend/src/lib/auth/AuthProvider.tsx
      - taskflow-frontend/src/lib/api/services.ts
        - taskflow-frontend/src/lib/api/client.ts
          - taskflow-frontend/src/lib/config.ts
          - taskflow-frontend/src/lib/auth/session.ts
      - taskflow-frontend/src/lib/firebase.ts
      - taskflow-frontend/src/lib/navigation.ts
- taskflow-frontend/src/app/(auth)/layout.tsx
- taskflow-frontend/src/app/(auth)/login/page.tsx
  - taskflow-frontend/src/components/ui/Button.tsx
    - taskflow-frontend/src/lib/utils.ts
  - taskflow-frontend/src/components/ui/Input.tsx

## /register

Entry: taskflow-frontend/src/app/(auth)/register/page.tsx
Dependencies:
- taskflow-frontend/src/app/layout.tsx
  - taskflow-frontend/src/lib/Providers.tsx
    - taskflow-frontend/src/lib/api/errors.ts
      - taskflow-frontend/src/lib/api/types.ts
    - taskflow-frontend/src/lib/auth/AuthProvider.tsx
      - taskflow-frontend/src/lib/api/services.ts
        - taskflow-frontend/src/lib/api/client.ts
          - taskflow-frontend/src/lib/config.ts
          - taskflow-frontend/src/lib/auth/session.ts
      - taskflow-frontend/src/lib/firebase.ts
      - taskflow-frontend/src/lib/navigation.ts
- taskflow-frontend/src/app/(auth)/layout.tsx
- taskflow-frontend/src/app/(auth)/register/page.tsx
  - taskflow-frontend/src/components/ui/Button.tsx
    - taskflow-frontend/src/lib/utils.ts
  - taskflow-frontend/src/components/ui/Input.tsx
