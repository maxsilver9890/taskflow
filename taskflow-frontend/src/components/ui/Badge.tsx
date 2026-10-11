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
