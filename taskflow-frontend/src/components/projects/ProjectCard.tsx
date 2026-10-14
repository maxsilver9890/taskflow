"use client";

import { ArrowUpRight, CalendarDays, Check, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/DropdownMenu";
import { useProjectDashboard } from "@/hooks/use-projects";
import type { Project } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDueDate } from "@/lib/utils";

export function ProjectCard({
  project,
  featured = false,
  dark = false,
  onEdit,
  onDelete,
}: {
  project: Project;
  featured?: boolean;
  dark?: boolean;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}) {
  const { isAdmin } = useAuth();
  const { data: dashboard, isError: dashboardError } = useProjectDashboard(project.id);
  const total = dashboard ? Object.values(dashboard.counts).reduce((a, b) => a + b, 0) : 0;
  const completed = dashboard?.counts.done ?? 0;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  return (
    <article className={`tf-project-card group tf-pop-in relative flex flex-col ${featured ? "tf-project-featured" : ""} ${dark ? "tf-project-dark" : ""}`}>
      <div className="tf-project-card-meta">
        <span>{featured ? "Featured project" : "Project"}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="tf-project-menu tf-touch-target" aria-label={`Options for ${project.name}`}>
              <MoreHorizontal className="size-5" />
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

      <Link href={`/projects/${project.id}`} className="tf-project-card-main">
        <h3>{project.name}</h3>
        <p>{project.description || "No description yet."}</p>
      </Link>

      <div className="tf-project-progress">
        <div className="tf-project-progress-label">
          <span>Project progress</span>
          <strong>{dashboard ? `${progress}%` : "—"}</strong>
        </div>
        <div className="tf-project-progress-track" role="progressbar" aria-label={`${project.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={dashboard ? progress : 0}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="tf-project-status-row" aria-label="Task status totals">
          {dashboard ? (
            <>
              <span><i className="tf-status-mark is-todo" /> To do <b>{dashboard.counts.todo}</b></span>
              <span><i className="tf-status-mark is-progress" /> In progress <b>{dashboard.counts.in_progress}</b></span>
              <span><i className="tf-status-mark is-review" /> Review <b>{dashboard.counts.review}</b></span>
              <span><i className="tf-status-mark is-done"><Check className="size-2.5" /></i> Done <b>{dashboard.counts.done}</b></span>
            </>
          ) : <span>{dashboardError ? "Task status unavailable" : "Loading task status…"}</span>}
        </div>
      </div>

      <div className="tf-project-card-footer">
        <span><CalendarDays className="size-3.5" /> Created {formatDueDate(project.createdAt, true)}</span>
        <Link href={`/projects/${project.id}`} aria-label={`Open ${project.name}`}>
          Open project <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </article>
  );
}
