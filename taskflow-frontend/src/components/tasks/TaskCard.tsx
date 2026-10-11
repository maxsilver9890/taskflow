"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";

import { AvatarStack } from "@/components/ui/Avatar";
import { PriorityBadge } from "@/components/ui/Badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/DropdownMenu";
import type { Task } from "@/lib/api/types";
import { cn, formatDueDate, isOverdue } from "@/lib/utils";

export function TaskCard({
  task,
  onEdit,
  onAssign,
  onDelete,
  showProjectBadge,
  projectName,
  dragHandleProps,
  isDragging,
}: {
  task: Task;
  onEdit: () => void;
  onAssign: () => void;
  onDelete: () => void;
  showProjectBadge?: boolean;
  projectName?: string;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}) {
  const overdue = isOverdue(task.dueDate, task.status === "DONE");

  return (
    <div
      {...dragHandleProps}
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 shadow-sm transition-shadow",
        "hover:border-line-strong hover:shadow-pop",
        isDragging && "rotate-1 opacity-90 shadow-pop",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13.5px] font-medium leading-snug text-ink hover:text-brand">{task.title}</p>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-ink-3 opacity-0 transition-opacity hover:bg-surface-2 hover:text-ink group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label="Task options"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="size-3.5" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onAssign}>
              <UserPlus className="size-3.5" /> Assign
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDelete} destructive>
              <Trash2 className="size-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showProjectBadge && projectName && (
        <span className="w-fit truncate rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-3">{projectName}</span>
      )}

      <div className="flex items-center justify-between gap-2">
        <PriorityBadge priority={task.priority} />
        {task.dueDate && (
          <span className={cn("flex items-center gap-1 text-[11.5px]", overdue ? "font-medium text-danger" : "text-ink-3")}>
            <Calendar className="size-3" />
            {formatDueDate(task.dueDate, true)}
          </span>
        )}
      </div>

      {task.assignments.length > 0 && (
        <div className="flex items-center justify-between border-t border-line pt-2">
          <AvatarStack names={task.assignments.map((a) => a.user.name)} />
        </div>
      )}
    </div>
  );
}

/** Draggable wrapper for the Kanban board. */
export function SortableTaskCard(props: Parameters<typeof TaskCard>[0] & { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard {...props} dragHandleProps={{ ...attributes, ...listeners }} isDragging={isDragging} />
    </div>
  );
}
