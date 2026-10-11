"use client";

import { ArrowUpRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/DropdownMenu";
import { useProjectDashboard } from "@/hooks/use-projects";
import type { Project } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDueDate } from "@/lib/utils";

const STATUS_ORDER = [
  { key: "todo", color: "bg-s-todo" },
  { key: "in_progress", color: "bg-s-progress" },
  { key: "review", color: "bg-s-review" },
  { key: "done", color: "bg-s-done" },
] as const;

export function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}) {
  const { isAdmin } = useAuth();
  const { data: dashboard } = useProjectDashboard(project.id);
  const total = dashboard ? Object.values(dashboard.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="group tf-pop-in relative flex flex-col rounded-xl border border-line bg-surface p-4 transition-shadow hover:shadow-pop">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[15px] font-semibold text-ink group-hover:text-brand">{project.name}</h3>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-3 opacity-0 transition-opacity hover:bg-surface-2 hover:text-ink group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label="Project options"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => onEdit(project)}>
              <Pencil className="size-3.5" /> Edit
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onSelect={() => onDelete(project)} destructive>
                <Trash2 className="size-3.5" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="mt-1.5 line-clamp-2 min-h-[2.5em] text-[13px] text-ink-3">
        {project.description || "No description yet."}
      </p>

      {total > 0 && dashboard ? (
        <div className="mt-3.5">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-2">
            {STATUS_ORDER.map(({ key, color }) => {
              const count = dashboard.counts[key];
              if (!count) return null;
              return <div key={key} className={color} style={{ width: `${(count / total) * 100}%` }} />;
            })}
          </div>
          <p className="mt-1.5 text-[12px] text-ink-3">
            {dashboard.counts.done}/{total} tasks done
          </p>
        </div>
      ) : (
        <p className="mt-3.5 text-[12px] text-ink-3">No tasks yet</p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[11.5px] text-ink-3">
        <span>Created {formatDueDate(project.createdAt, true)}</span>
        <Link href={`/projects/${project.id}`} className="flex items-center gap-0.5 font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
          Open <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
