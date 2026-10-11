"use client";

import { Calendar, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";

import { AvatarStack } from "@/components/ui/Avatar";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/DropdownMenu";
import { RowSkeleton } from "@/components/ui/Skeleton";
import type { Project, Task } from "@/lib/api/types";
import { cn, formatDueDate, isOverdue } from "@/lib/utils";

export function TaskTable({
  tasks,
  projectsById,
  onEdit,
  onAssign,
  onDelete,
  loading,
}: {
  tasks: Task[];
  projectsById: Map<string, Project>;
  onEdit: (task: Task) => void;
  onAssign: (task: Task) => void;
  onDelete: (task: Task) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {Array.from({ length: 8 }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11.5px] uppercase tracking-wide text-ink-3">
              <th className="px-4 py-2.5 font-medium">Task</th>
              <th className="px-4 py-2.5 font-medium">Project</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">Due</th>
              <th className="px-4 py-2.5 font-medium">Assignees</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const overdue = isOverdue(task.dueDate, task.status === "DONE");
              return (
                <tr key={task.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/tasks/${task.id}`} className="font-medium text-ink hover:text-brand">
                      {task.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-3">{projectsById.get(task.projectId)?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-4 py-3">
                    {task.dueDate ? (
                      <span className={cn("flex items-center gap-1", overdue ? "font-medium text-danger" : "text-ink-2")}>
                        <Calendar className="size-3" />
                        {formatDueDate(task.dueDate, true)}
                      </span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <AvatarStack names={task.assignments.map((a) => a.user.name)} />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex size-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Task options">
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => onEdit(task)}>
                          <Pencil className="size-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onAssign(task)}>
                          <UserPlus className="size-3.5" /> Assign
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onDelete(task)} destructive>
                          <Trash2 className="size-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
