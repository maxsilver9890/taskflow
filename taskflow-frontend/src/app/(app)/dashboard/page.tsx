"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, Circle,
  ClipboardList, FolderKanban, Plus, Users,
} from "lucide-react";

import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useAllProjects } from "@/hooks/use-projects";
import { useOrgMembers } from "@/hooks/use-organization";
import { useProjectTasks } from "@/hooks/use-tasks";
import { useAuth } from "@/lib/auth/AuthProvider";
import { notificationsApi } from "@/lib/api/services";
import type { Task, TaskStatus } from "@/lib/api/types";
import { qk } from "@/lib/query-keys";
import { formatDueDate, isOverdue } from "@/lib/utils";

const columns: { status: TaskStatus; label: string; icon: typeof Circle; tone: string }[] = [
  { status: "TODO", label: "To do", icon: Circle, tone: "bg-white" },
  { status: "IN_PROGRESS", label: "In progress", icon: Activity, tone: "bg-brand" },
  { status: "REVIEW", label: "In review", icon: ClipboardList, tone: "bg-[#e7dfc9]" },
  { status: "DONE", label: "Done", icon: Check, tone: "bg-ink text-canvas" },
];

const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export default function DashboardPage() {
  const { user, organizationName } = useAuth();
  const projects = useAllProjects();
  const members = useOrgMembers();
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const selectedProject = projects.data?.find((project) => project.id === selectedProjectId) ?? projects.data?.[0];
  const projectTasks = useProjectTasks(selectedProject?.id ?? "");
  const notifications = useQuery({ queryKey: qk.notifications.all(), queryFn: notificationsApi.list });

  const tasks = projectTasks.data?.tasks ?? [];
  const groupedTasks = Object.fromEntries(
    columns.map(({ status }) => [status, tasks.filter((task) => task.status === status)]),
  ) as Record<TaskStatus, Task[]>;
  const activeCount = tasks.filter((task) => task.status !== "DONE").length;
  const overdueCount = tasks.filter((task) => isOverdue(task.dueDate, task.status === "DONE")).length;
  const dueTodayCount = tasks.filter((task) => task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString() && task.status !== "DONE").length;
  const unreadCount = notifications.data?.data.filter((entry) => !entry.readAt).length ?? 0;

  return (
    <div className="min-w-0">
      <header className="border-b-2 border-line bg-surface px-4 py-5 md:px-7 md:py-6">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[.2em] text-ink-3">{organizationName ?? "Your workspace"}</p>
            <h1 className="font-display text-3xl uppercase leading-tight tracking-[-.05em] sm:text-4xl">Dashboard</h1>
            <p className="mt-1 text-sm text-ink-2">{user ? `Good to have you back, ${user.name.split(" ")[0]}. ` : ""}A clear view of the work moving your team forward.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/team" className="inline-flex min-h-11 items-center gap-2 border-2 border-line bg-surface px-4 py-2 text-xs font-bold uppercase shadow-pop transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none">
              <Users className="size-4" /> Invite team
            </Link>
            <Button onClick={() => setTaskFormOpen(true)} className="min-h-11 rounded-none border-2 border-line bg-ink px-4 text-xs font-bold uppercase text-brand shadow-pop hover:bg-ink-2">
              <Plus className="size-4" /> Create task
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-w-0 max-w-[1600px] grid-cols-1 gap-5 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_290px] xl:gap-6">
        <main className="flex min-w-0 flex-col gap-6">
          <div className="overflow-hidden border-2 border-line bg-ink py-2 text-brand shadow-pop" aria-label="Workspace summary">
            <div className="flex min-w-max animate-[tf-marquee_28s_linear_infinite] items-center gap-8 px-4 text-[10px] font-bold uppercase tracking-[.16em] motion-reduce:animate-none">
              <span>{organizationName ?? "TaskFlow workspace"} / Work in motion</span><span aria-hidden="true">✳</span>
              <span>{projects.data?.length ?? 0} projects in your workspace</span><span aria-hidden="true">✳</span>
              <span>{members.total} team members</span><span aria-hidden="true">✳</span>
              <span>{unreadCount} unread updates</span><span aria-hidden="true">✳</span>
              <span aria-hidden="true">{organizationName ?? "TaskFlow workspace"} / Work in motion</span><span aria-hidden="true">✳</span>
              <span aria-hidden="true">{projects.data?.length ?? 0} projects in your workspace</span><span aria-hidden="true">✳</span>
            </div>
          </div>

          <section className="grid gap-5 lg:grid-cols-12" aria-label="Workspace overview">
            <div className="relative isolate overflow-hidden border-2 border-line bg-surface p-5 shadow-[8px_8px_0_#090909] sm:p-8 lg:col-span-8">
              <div className="pointer-events-none absolute inset-0 -z-10 opacity-[.07]" style={{ backgroundImage: "radial-gradient(#09090B 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[.2em] text-ink-3">Workspace overview</p>
              <h2 className="max-w-3xl font-display text-4xl uppercase leading-[.98] tracking-[-.06em] sm:text-6xl">Move work<br className="hidden sm:block" /> forward.</h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-2">
                {selectedProject ? <>Your team has <strong className="bg-brand px-1 text-ink">{activeCount} active {activeCount === 1 ? "task" : "tasks"}</strong> in <strong>{selectedProject.name}</strong>.</> : <>Bring projects, task ownership, and team updates together in one workspace.</>}
                {dueTodayCount > 0 && <> <strong className="bg-brand px-1 text-ink">{dueTodayCount} due today</strong>.</>}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button onClick={() => setTaskFormOpen(true)} className="min-h-12 rounded-none border-2 border-line bg-ink px-5 font-bold uppercase text-brand shadow-pop hover:bg-ink-2">
                  <Plus className="size-4" /> Create new task
                </Button>
                <Link href="/team" className="inline-flex min-h-12 items-center justify-center gap-2 border-2 border-line bg-white px-5 font-bold uppercase shadow-pop transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none">
                  Invite team <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
              <article className="relative flex min-h-36 flex-col justify-between border-2 border-line bg-ink p-5 text-canvas shadow-pop">
                <Activity className="absolute right-4 top-4 size-6 text-brand" aria-hidden="true" />
                <p className="font-display text-lg uppercase">Project pulse</p>
                <div><p className="font-display text-5xl leading-none text-brand">{projectTasks.isLoading ? "—" : activeCount}</p><p className="mt-2 text-xs text-canvas/70">Open tasks in this project</p></div>
              </article>
              <article className="flex min-h-36 flex-col justify-between border-2 border-line bg-white p-5 shadow-pop">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-display text-lg uppercase">Projects</p><p className="mt-1 text-xs text-ink-3">Across your workspace</p></div>
                  <FolderKanban className="size-5" aria-hidden="true" />
                </div>
                {projects.isLoading ? <Skeleton className="h-10 w-14" /> : <p className="font-display text-5xl leading-none">{projects.data?.length ?? 0}</p>}
              </article>
            </div>
          </section>

          <section aria-labelledby="board-heading" className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[.2em] text-ink-3">Your work, organized</p>
                <h2 id="board-heading" className="font-display text-xl uppercase tracking-[-.04em] sm:text-2xl">Project board</h2>
              </div>
              <div className="flex items-center gap-2">
                {projects.data && projects.data.length > 0 && <label className="sr-only" htmlFor="dashboard-project">Choose project</label>}
                {projects.data && projects.data.length > 0 && <select id="dashboard-project" value={selectedProject?.id ?? ""} onChange={(event) => setSelectedProjectId(event.target.value)} className="min-h-10 max-w-[48vw] border-2 border-line bg-white px-3 text-xs font-bold shadow-pop sm:max-w-64">
                  {projects.data.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>}
                <Link href={selectedProject ? `/projects/${selectedProject.id}` : "/projects"} aria-label="View project" className="grid size-10 shrink-0 place-items-center border-2 border-line bg-white shadow-pop transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"><ArrowUpRight className="size-4" /></Link>
              </div>
            </div>

            {projects.isLoading || projectTasks.isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{columns.map(({ status }) => <Skeleton key={status} className="h-64 border-2 border-line" />)}</div>
            ) : projects.isError ? (
              <ErrorState error={projects.error} onRetry={projects.refetch} />
            ) : !selectedProject ? (
              <div className="border-2 border-dashed border-line p-6"><EmptyState title="Your board starts with a project" description="Create a project to organize tasks and see them move across the board." action={<Button onClick={() => setProjectFormOpen(true)}><Plus className="size-4" /> Create project</Button>} /></div>
            ) : projectTasks.isError ? (
              <ErrorState error={projectTasks.error} onRetry={projectTasks.refetch} />
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                {columns.map(({ status, label, icon: Icon, tone }) => {
                  const columnTasks = groupedTasks[status] ?? [];
                  return <section key={status} aria-label={`${label}: ${columnTasks.length} tasks`} className="min-w-0">
                    <div className={`mb-3 flex items-center justify-between border-2 border-line p-3 shadow-pop ${tone}`}>
                      <span className="flex items-center gap-2 font-display text-xs uppercase"><Icon className="size-4" />{label}</span>
                      <span className="grid min-h-7 min-w-7 place-items-center border border-line bg-surface px-1 text-xs font-bold">{String(columnTasks.length).padStart(2, "0")}</span>
                    </div>
                    <div className="flex min-h-28 flex-col gap-3">
                      {columnTasks.slice(0, 4).map((task) => <TaskCard key={task.id} task={task} />)}
                      {columnTasks.length === 0 && <p className="border-2 border-dashed border-line/50 p-4 text-center text-xs text-ink-3">No tasks here yet</p>}
                      {columnTasks.length > 4 && <Link href={`/tasks?projectId=${selectedProject.id}`} className="border-2 border-line bg-white p-3 text-center text-xs font-bold uppercase shadow-pop hover:bg-brand">+{columnTasks.length - 4} more tasks</Link>}
                      {status === "TODO" && <button onClick={() => setTaskFormOpen(true)} className="min-h-11 border-2 border-dashed border-line/60 p-3 text-left text-xs font-bold uppercase text-ink-3 hover:border-line hover:bg-brand hover:text-ink">+ Add task</button>}
                    </div>
                  </section>;
                })}
              </div>
            )}
            {projectTasks.data?.truncated && <p className="mt-3 text-xs text-ink-3">Showing the first 500 tasks for this project.</p>}
          </section>
        </main>

        <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:self-start">
          <section className="flex min-h-72 min-w-0 flex-col border-2 border-line bg-white p-5 shadow-pop">
            <div className="mb-5 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-base uppercase"><Activity className="size-4" /> Activity feed</h2>
              <span className="border-2 border-line bg-brand px-2 py-1 text-[10px] font-bold">{unreadCount} NEW</span>
            </div>
            {notifications.isLoading ? <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : notifications.isError ? <p className="text-xs text-ink-3">Updates are temporarily unavailable.</p> : notifications.data?.data.length ? <ul className="flex-1 space-y-4 overflow-y-auto pr-1">
              {notifications.data.data.slice(0, 6).map((entry) => <li key={entry.id}>
                <Link href={entry.link ?? "/notifications"} className="flex gap-3 rounded-sm outline-offset-2 hover:bg-surface-2">
                  <span className={`grid size-8 shrink-0 place-items-center border-2 border-line ${entry.readAt ? "bg-surface-2" : "bg-brand"}`}><Bell className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-xs font-bold leading-snug">{entry.title}</span><span className="mt-1 block line-clamp-2 text-[11px] leading-snug text-ink-2">{entry.message}</span><span className="mt-1 block text-[9px] font-bold uppercase tracking-wide text-ink-3">{formatDueDate(entry.createdAt, true)}</span></span>
                </Link>
              </li>)}
            </ul> : <p className="flex-1 py-4 text-xs text-ink-3">No updates yet. Team activity will appear here.</p>}
            <Link href="/notifications" className="mt-5 border-t-2 border-line pt-3 text-center text-xs font-bold uppercase underline underline-offset-4">View all updates</Link>
          </section>

          <section className="border-2 border-line bg-ink p-5 text-brand shadow-pop">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em]">Team on TaskFlow</p>
            <div className="flex items-end justify-between gap-3">
              <div><p className="font-display text-3xl uppercase">{members.isLoading ? "—" : members.total} members</p><p className="mt-1 text-xs text-canvas/70">Working together in this organization</p></div>
              <Link href="/team" aria-label="View team" className="grid size-10 shrink-0 place-items-center border-2 border-brand text-brand hover:bg-brand hover:text-ink"><ArrowRight className="size-4" /></Link>
            </div>
            {members.members.length > 0 && <div className="mt-4 flex -space-x-2" aria-label="Organization members">
              {members.members.slice(0, 5).map((member) => <span key={member.userId} title={member.name} className="grid size-9 place-items-center rounded-full border-2 border-ink bg-brand text-[10px] font-bold text-ink">{initials(member.name)}</span>)}
              {members.total > 5 && <span className="grid size-9 place-items-center rounded-full border-2 border-ink bg-canvas text-[10px] font-bold text-ink">+{members.total - 5}</span>}
            </div>}
          </section>

          <Link href={overdueCount ? "/tasks?overdue=1" : "/tasks"} className="flex items-center gap-3 border-2 border-line bg-white p-4 shadow-pop hover:bg-brand">
            <CalendarDays className="size-5 shrink-0" />
            <span className="min-w-0 flex-1"><span className="block font-display text-sm uppercase">{overdueCount ? `${overdueCount} overdue` : "You’re on track"}</span><span className="block text-xs text-ink-3">{overdueCount ? "Review tasks that need attention" : "No overdue work in this project"}</span></span>
            <ArrowUpRight className="size-4 shrink-0" />
          </Link>
        </aside>
      </div>

      <TaskFormDialog open={taskFormOpen} onOpenChange={setTaskFormOpen} defaultProjectId={selectedProject?.id} />
      <ProjectFormDialog open={projectFormOpen} onOpenChange={setProjectFormOpen} />
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const due = task.dueDate ? formatDueDate(task.dueDate, true) : null;
  const overdue = isOverdue(task.dueDate, task.status === "DONE");
  const assignee = task.assignments[0]?.user;
  return <Link href={`/tasks/${task.id}`} className="group block border-2 border-line bg-white p-4 shadow-pop transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none focus-visible:outline-offset-4">
    <div className="mb-3 flex items-start justify-between gap-2">
      <span className="max-w-[75%] truncate border border-line bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">{task.priority} priority</span>
      <ArrowUpRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </div>
    <h3 className="line-clamp-3 text-sm font-bold leading-snug group-hover:underline">{task.title}</h3>
    <div className="mt-4 flex items-center justify-between gap-2 border-t border-line/20 pt-3">
      <span className={`flex min-w-0 items-center gap-1.5 truncate text-[10px] font-bold ${overdue ? "text-danger" : "text-ink-2"}`}>
        <CalendarDays className="size-3 shrink-0" />{due ?? "No due date"}
      </span>
      {assignee ? <span title={assignee.name} className="grid size-7 shrink-0 place-items-center border-2 border-line bg-brand text-[9px] font-bold">{initials(assignee.name)}</span> : <span className="text-[9px] font-bold uppercase text-ink-3">Unassigned</span>}
    </div>
  </Link>;
}
