# Shared UI Components — TaskFlow

Framework: React 19 with Next.js App Router; styling uses Tailwind CSS v4 utility classes and shared CSS variables.

## Avatar

- File: taskflow-frontend/src/components/ui/Avatar.tsx
- Shared primitive: reusable UI building block.

```tsx
import { cn, initials } from "@/lib/utils";

const PALETTE = [
  "bg-[#0d6b5e] text-white",
  "bg-[#2563eb] text-white",
  "bg-[#b7791f] text-white",
  "bg-[#7c3aed] text-white",
  "bg-[#be185d] text-white",
  "bg-[#0e7490] text-white",
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = { sm: "size-6 text-[10px]", md: "size-8 text-[12px]", lg: "size-11 text-[14px]" }[size];
  return (
    <span
      title={name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", dims, colorFor(name), className)}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  if (names.length === 0) return null;
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((n, i) => (
        <Avatar key={n + i} name={n} size="sm" className="ring-2 ring-surface" />
      ))}
      {rest > 0 && (
        <span className="flex size-6 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-ink-2 ring-2 ring-surface">
          +{rest}
        </span>
      )}
    </div>
  );
}
```

## Badge

- File: taskflow-frontend/src/components/ui/Badge.tsx
- Shared primitive: reusable UI building block.

```tsx
import type { ReactNode } from "react";

import type { TaskPriority, TaskStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  dotClassName,
}: {
  children: ReactNode;
  className?: string;
  dotClassName?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium leading-none",
        className,
      )}
    >
      {dotClassName && <span className={cn("size-1.5 rounded-full", dotClassName)} />}
      {children}
    </span>
  );
}

const STATUS_META: Record<TaskStatus, { label: string; bg: string; fg: string; dot: string }> = {
  TODO: { label: "To do", bg: "bg-s-todo-soft", fg: "text-s-todo", dot: "bg-s-todo" },
  IN_PROGRESS: { label: "In progress", bg: "bg-s-progress-soft", fg: "text-s-progress", dot: "bg-s-progress" },
  REVIEW: { label: "Review", bg: "bg-s-review-soft", fg: "text-s-review", dot: "bg-s-review" },
  DONE: { label: "Done", bg: "bg-s-done-soft", fg: "text-s-done", dot: "bg-s-done" },
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <Badge className={cn(m.bg, m.fg, className)} dotClassName={m.dot}>
      {m.label}
    </Badge>
  );
}

const PRIORITY_META: Record<TaskPriority, { label: string; fg: string }> = {
  LOW: { label: "Low", fg: "text-p-low" },
  MEDIUM: { label: "Medium", fg: "text-p-medium" },
  HIGH: { label: "High", fg: "text-p-high" },
  URGENT: { label: "Urgent", fg: "text-p-urgent" },
};

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  const m = PRIORITY_META[priority];
  return (
    <Badge className={cn("bg-surface-2", m.fg, className)} dotClassName={cn("bg-current")}>
      {m.label}
    </Badge>
  );
}
```

## Button

- File: taskflow-frontend/src/components/ui/Button.tsx
- Shared primitive: reusable UI building block.

```tsx
"use client";

import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-hover shadow-sm",
  secondary: "bg-surface-2 text-ink hover:bg-line",
  outline: "border border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
  icon: "h-9 w-9 p-0",
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium",
        "transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
```

## Card

- File: taskflow-frontend/src/components/ui/Card.tsx
- Shared primitive: reusable UI building block.

```tsx
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-line bg-surface", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-line p-4", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}
```

## ConfirmDialog

- File: taskflow-frontend/src/components/ui/ConfirmDialog.tsx
- Shared primitive: reusable UI building block.

```tsx
"use client";

import { Button } from "./Button";
import { Dialog } from "./Dialog";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant={destructive ? "danger" : "primary"} size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <></>
    </Dialog>
  );
}
```

## Dialog

- File: taskflow-frontend/src/components/ui/Dialog.tsx
- Shared primitive: reusable UI building block.

```tsx
"use client";

import * as RDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const width = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl" }[size];
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[1px] data-[state=open]:animate-[tf-fade-in_0.15s_ease-out]" />
        <RDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 tf-pop-in",
            "max-h-[85vh] overflow-y-auto rounded-2xl border border-line bg-surface shadow-pop focus:outline-none",
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line p-5">
            <div>
              <RDialog.Title className="text-[16px] font-semibold text-ink">{title}</RDialog.Title>
              {description && <RDialog.Description className="mt-1 text-[13px] text-ink-3">{description}</RDialog.Description>}
            </div>
            <RDialog.Close asChild>
              <button
                aria-label="Close"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </RDialog.Close>
          </div>
          <div className="p-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line p-4">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
```

## DropdownMenu

- File: taskflow-frontend/src/components/ui/DropdownMenu.tsx
- Shared primitive: reusable UI building block.

```tsx
"use client";

import * as RDropdown from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const DropdownMenu = RDropdown.Root;
export const DropdownMenuTrigger = RDropdown.Trigger;

export function DropdownMenuContent({ children, align = "end" }: { children: ReactNode; align?: "start" | "end" | "center" }) {
  return (
    <RDropdown.Portal>
      <RDropdown.Content
        align={align}
        sideOffset={6}
        className="tf-pop-in z-50 min-w-[180px] overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-pop"
      >
        {children}
      </RDropdown.Content>
    </RDropdown.Portal>
  );
}

export function DropdownMenuItem({
  children,
  onSelect,
  destructive,
  disabled,
}: {
  children: ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <RDropdown.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] outline-none transition-colors",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        destructive ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-surface-2",
      )}
    >
      {children}
    </RDropdown.Item>
  );
}
```

## Input

- File: taskflow-frontend/src/components/ui/Input.tsx
- Shared primitive: reusable UI building block.

```tsx
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3",
        "outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3",
        "outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-ink-2", className)} {...props} />;
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-1 text-[12.5px] text-danger">{children}</p>;
}
```

## Pagination

- File: taskflow-frontend/src/components/ui/Pagination.tsx
- Shared primitive: reusable UI building block.

```tsx
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "./Button";

export function Pagination({
  page,
  limit,
  total,
  onPageChange,
}: {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[13px] text-ink-3">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
```

## Select

- File: taskflow-frontend/src/components/ui/Select.tsx
- Shared primitive: reusable UI building block.

```tsx
import { ChevronDown } from "lucide-react";
import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, Props>(
  ({ className, wrapperClassName, children, ...props }, ref) => (
    <div className={cn("relative", wrapperClassName)}>
      <select
        ref={ref}
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-line bg-surface pl-3 pr-8 text-sm text-ink",
          "outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
    </div>
  ),
);
Select.displayName = "Select";
```

## Skeleton

- File: taskflow-frontend/src/components/ui/Skeleton.tsx
- Shared primitive: reusable UI building block.

```tsx
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("tf-skeleton rounded-md", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <Skeleton className="mb-3 h-4 w-2/3" />
      <Skeleton className="mb-2 h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3">
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-6 w-6 rounded-full" />
    </div>
  );
}
```

## States

- File: taskflow-frontend/src/components/ui/States.tsx
- Shared primitive: reusable UI building block.

```tsx
import { AlertTriangle, Inbox, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { errorMessage } from "@/lib/api/errors";
import { Button } from "./Button";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="tf-fade-in flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink-3">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div>
        <p className="text-[15px] font-medium text-ink">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-3">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const isNetwork = errorMessage(error).includes("reach the TaskFlow API");
  return (
    <div className="tf-fade-in flex flex-col items-center justify-center gap-3 rounded-xl border border-line bg-danger-soft/40 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        {isNetwork ? <WifiOff className="size-5" /> : <AlertTriangle className="size-5" />}
      </div>
      <div>
        <p className="text-[15px] font-medium text-ink">Something went wrong</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-3">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function InlineSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-ink-3">
      <span className="size-4 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label}
    </div>
  );
}
```

## Tooltip

- File: taskflow-frontend/src/components/ui/Tooltip.tsx
- Shared primitive: reusable UI building block.

```tsx
import { cn } from "@/lib/utils";

export function TooltipText({ children, className }: { children: string; className?: string }) {
  return (
    <span title={children} className={cn(className)}>
      {children}
    </span>
  );
}
```
