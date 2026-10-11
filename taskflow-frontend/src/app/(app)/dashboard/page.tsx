"use client";

import { AlertTriangle, ArrowUpRight, CheckCircle2, ListChecks, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useAllProjects } from "@/hooks/use-projects";
import { useTaskList } from "@/hooks/use-tasks";
import { useAuth } from "@/lib/auth/AuthProvider";
import { endOfDayPlusIso, formatDueDate, isOverdue, startOfTodayIso } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  const projects = useAllProjects();
  const myTasks = useTaskList({ assignee: user?.id, limit: 100 });
  const overdueWindow = useTaskList({
    dueFrom: "1970-01-01T00:00:00.000Z",
    dueTo: startOfTodayIso(),
    limit: 100,
  });
  const upcomingWindow = useTaskList({
    dueFrom: startOfTodayIso(),
    dueTo: endOfDayPlusIso(7),
    limit: 5,
  });

  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);

  const myOpenTasks = useMemo(
    () => (myTasks.data?.data ?? []).filter((t) => t.status !== "DONE"),
    [myTasks.data],
  );
  const overdueTasks = useMemo(
    () => (overdueWindow.data?.data ?? []).filter((t) => isOverdue(t.dueDate, t.status === "DONE")),
    [overdueWindow.data],
  );
  const overdueCount = overdueTasks.length;

  return (
    <div>
      <PageHeader
        title={`Welcome back${user ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="Here's what's happening across your organization."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setProjectFormOpen(true)}>
              <Plus className="size-3.5" /> Project
            </Button>
            <Button size="sm" onClick={() => setTaskFormOpen(true)}>
              <Plus className="size-4" /> Task
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 p-4 md:grid-cols-3 md:p-6">
        <div className="space-y-5 md:col-span-2">
          {/* Summary tiles */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryTile
              icon={<ListChecks className="size-4" />}
              label="Projects"
              value={projects.isLoading ? null : projects.data?.length ?? 0}
              href="/projects"
            />
            <SummaryTile
              icon={<CheckCircle2 className="size-4" />}
              label="My open tasks"
              value={myTasks.isLoading ? null : myOpenTasks.length}
              href={user ? `/tasks?assignee=${user.id}` : "/tasks"}
            />
            <SummaryTile
              icon={<AlertTriangle className="size-4" />}
              label="Overdue"
              value={overdueWindow.isLoading ? null : overdueCount}
              href="/tasks?overdue=1"
              accent={overdueCount > 0 ? "text-danger" : undefined}
            />
          </div>

          {/* My tasks */}
          <section className="rounded-xl border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-[13.5px] font-semibold text-ink">My tasks</h2>
              <Link href={user ? `/tasks?assignee=${user.id}` : "/tasks"} className="flex items-center gap-0.5 text-[12.5px] font-medium text-brand hover:underline">
                View all <ArrowUpRight className="size-3" />
              </Link>
            </div>
            {myTasks.isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : myTasks.isError ? (
              <div className="p-4">
                <ErrorState error={myTasks.error} onRetry={myTasks.refetch} />
              </div>
            ) : myOpenTasks.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No open tasks assigned to you" description="Enjoy the calm, or pick up something new." />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {myOpenTasks.slice(0, 6).map((task) => (
                  <li key={task.id}>
                    <Link href={`/tasks/${task.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{task.title}</span>
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-5">
          {/* Due soon */}
          <section className="rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-[13.5px] font-semibold text-ink">Due in the next 7 days</h2>
            </div>
            {upcomingWindow.isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : (upcomingWindow.data?.data.length ?? 0) === 0 ? (
              <p className="p-4 text-[13px] text-ink-3">Nothing due soon.</p>
            ) : (
              <ul className="divide-y divide-line">
                {upcomingWindow.data!.data.map((task) => (
                  <li key={task.id}>
                    <Link href={`/tasks/${task.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-surface-2">
                      <span className="min-w-0 truncate text-[13px] text-ink">{task.title}</span>
                      <span className="shrink-0 text-[11.5px] text-ink-3">{task.dueDate && formatDueDate(task.dueDate, true)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Overdue */}
          <section className="rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-3">
              <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-danger">
                <AlertTriangle className="size-3.5" /> Overdue
              </h2>
            </div>
            {overdueWindow.isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : overdueTasks.length === 0 ? (
              <p className="p-4 text-[13px] text-ink-3">Nothing overdue. Nice work.</p>
            ) : (
              <ul className="divide-y divide-line">
                {overdueTasks.slice(0, 5).map((task) => (
                    <li key={task.id}>
                      <Link href={`/tasks/${task.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-surface-2">
                        <span className="min-w-0 truncate text-[13px] text-ink">{task.title}</span>
                        <span className="shrink-0 text-[11.5px] font-medium text-danger">{task.dueDate && formatDueDate(task.dueDate, true)}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          {/* Recent projects */}
          <section className="rounded-xl border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-[13.5px] font-semibold text-ink">Projects</h2>
              <Link href="/projects" className="text-[12.5px] font-medium text-brand hover:underline">
                View all
              </Link>
            </div>
            {projects.isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : (projects.data?.length ?? 0) === 0 ? (
              <p className="p-4 text-[13px] text-ink-3">No projects yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {projects.data!.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-surface-2">
                      <span className="min-w-0 truncate text-[13px] text-ink">{p.name}</span>
                      <ArrowUpRight className="size-3.5 shrink-0 text-ink-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <ProjectFormDialog open={projectFormOpen} onOpenChange={setProjectFormOpen} />
      <TaskFormDialog open={taskFormOpen} onOpenChange={setTaskFormOpen} />
    </div>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  href,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  href: string;
  accent?: string;
}) {
  return (
    <Link href={href} className="rounded-xl border border-line bg-surface p-4 transition-shadow hover:shadow-pop">
      <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-3">
        {icon}
        {label}
      </span>
      {value === null ? (
        <Skeleton className="mt-2 h-7 w-10" />
      ) : (
        <p className={`mt-1 font-display text-[24px] font-bold ${accent ?? "text-ink"}`}>{value}</p>
      )}
    </Link>
  );
}
