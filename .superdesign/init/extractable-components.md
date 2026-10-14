# Extractable TaskFlow Components

## Layout Components

### AppShell
- Source: src/components/layout/AppShell.tsx
- Category: layout
- Description: Authenticated application shell with navigation, organization context, notifications, and user menu.
- Extractable props: active navigation item and any intentionally configurable shell visibility.
- Hardcoded: TaskFlow brand treatment, navigation labels, icon names, and shell styling.

### PageHeader
- Source: src/components/layout/PageHeader.tsx
- Category: layout
- Description: Reusable page title, description, and page-level actions.
- Extractable props: title, description, and action content.
- Hardcoded: typography, spacing, and responsive layout classes.

### Logo
- Source: src/components/layout/Logo.tsx
- Category: basic
- Description: Shared TaskFlow wordmark/brand mark.
- Extractable props: size or compact display mode if already exposed.
- Hardcoded: brand mark, text, and identity colors.

## Basic UI Components

### Button
- Source: src/components/ui/Button.tsx
- Category: basic
- Description: Shared button variants, sizes, loading, and disabled treatment.
- Extractable props: variant, size, loading, disabled, and button content.
- Hardcoded: semantic variants, icon spacing, focus, and transition classes.

### Input and Label
- Source: src/components/ui/Input.tsx
- Category: basic
- Description: Text fields, labels, helper/error messages, and textarea styling.
- Extractable props: field value/handlers, label, error, and input attributes.
- Hardcoded: field borders, focus behavior, and typography.

### Badge
- Source: src/components/ui/Badge.tsx
- Category: basic
- Description: Task status and priority badges.
- Extractable props: status, priority, and compactness.
- Hardcoded: semantic color mapping and badge styling.

### Avatar
- Source: src/components/ui/Avatar.tsx
- Category: basic
- Description: User initials/avatar display.
- Extractable props: name, image, and size.
- Hardcoded: fallback initials treatment and shape.

### Card
- Source: src/components/ui/Card.tsx
- Category: basic
- Description: Shared card surface, header, and body wrappers.
- Extractable props: children and optional class overrides.
- Hardcoded: surface, border, and elevation.

### Dialog and ConfirmDialog
- Source: src/components/ui/Dialog.tsx, src/components/ui/ConfirmDialog.tsx
- Category: basic
- Description: Accessible modal and confirmation patterns.
- Extractable props: open state, title/body, action labels, and callbacks.
- Hardcoded: overlay, modal spacing, and button hierarchy.

### DropdownMenu, Select, Tooltip, Pagination
- Source: src/components/ui/DropdownMenu.tsx, src/components/ui/Select.tsx, src/components/ui/Tooltip.tsx, src/components/ui/Pagination.tsx
- Category: basic
- Description: Shared interaction primitives used throughout the app.
- Extractable props: selected values, menu items, tooltip content, page state, and callbacks.
- Hardcoded: interaction states, focus, and spacing.

### Skeleton and States
- Source: src/components/ui/Skeleton.tsx, src/components/ui/States.tsx
- Category: basic
- Description: Loading, empty, and error state patterns.
- Extractable props: message, retry callback, and shape/size options where supported.
- Hardcoded: visual state hierarchy and motion.

## Feature Components

### ProjectCard and DashboardStats
- Source: src/components/projects/ProjectCard.tsx, src/components/analytics/DashboardStats.tsx
- Category: basic
- Description: Project summary card and project metric display.
- Extractable props: project summary data and metric values.

### KanbanBoard and TaskCard
- Source: src/components/tasks/KanbanBoard.tsx, src/components/tasks/TaskCard.tsx
- Category: basic
- Description: Status columns and task cards with assignment, priority, and due-date information.
- Extractable props: task records, members, status callbacks, and task selection behavior.

### CommentsSection
- Source: src/components/tasks/CommentsSection.tsx
- Category: basic
- Description: Task discussion thread with author attribution and role-aware actions.
- Extractable props: task id, current member identity/role, and comment callbacks.

### Notification Rows
- Source: src/components/notifications/JobRow.tsx, src/components/notifications/JobStatusPill.tsx
- Category: basic
- Description: Queued email delivery status and job history presentation.
- Extractable props: job data and status.