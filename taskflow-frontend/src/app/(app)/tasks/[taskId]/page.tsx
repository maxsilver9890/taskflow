"use client";

import { ArrowLeft, Check, FolderKanban, Pencil, Trash2, UserPlus, UserX } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { AssignDialog } from "@/components/tasks/AssignDialog";
import { CommentsSection } from "@/components/tasks/CommentsSection";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { Avatar } from "@/components/ui/Avatar";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useDeleteTask, useTaskDetail, useUnassignTask, useUpdateTask } from "@/hooks/use-tasks";
import { errorMessage } from "@/lib/api/errors";
import { cn, formatDateTime, formatDueDate, isOverdue } from "@/lib/utils";

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const router = useRouter();
  const { base, enrichedTask, siblings } = useTaskDetail(taskId);

  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();
  const unassignTask = useUnassignTask();
  const [unassigning, setUnassigning] = useState<string | null>(null);

  if (base.isError) {
    return (
      <div>
        <PageHeader title="Task" />
        <div className="p-4 md:p-6">
          <ErrorState error={base.error} onRetry={base.refetch} />
        </div>
      </div>
    );
  }

  const task = base.data;
  const overdue = task ? isOverdue(task.dueDate, task.status === "DONE") : false;

  async function confirmDelete() {
    if (!task) return;
    try {
      await deleteTask.mutateAsync(task.id);
      toast.success("Task deleted");
      router.replace(`/projects/${task.projectId}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function unassign(userId: string, name: string) {
    if (!task) return;
    setUnassigning(userId);
    try {
      await unassignTask.mutateAsync({ taskId: task.id, userId });
      toast.success(`Unassigned ${name}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUnassigning(null);
    }
  }

  async function completeTask() {
    if (!task) return;
    try {
      await updateTask.mutateAsync({ id: task.id, input: { status: "DONE" } });
      toast.success("Task completed");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader
        title={
          <>
            <Link
              href={task ? `/projects/${task.projectId}` : "/tasks"}
              className="flex size-6 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              <ArrowLeft className="size-4" />
            </Link>
            {base.isLoading ? <Skeleton className="h-6 w-56" /> : task?.title}
          </>
        }
        actions={
          task && (
            <>
              {task.status !== "DONE" && <Button size="sm" onClick={() => void completeTask()} loading={updateTask.isPending}><Check className="size-3.5" /> Complete task</Button>}
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="size-3.5" /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
                <UserPlus className="size-3.5" /> Assign
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-3.5" />
              </Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-5 p-4 md:grid-cols-3 md:p-6">
        <div className="space-y-5 md:col-span-2">
          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="mb-2 text-[13px] font-semibold text-ink-2">Description</h2>
            {base.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : task?.description ? (
              <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{task.description}</p>
            ) : (
              <p className="text-[13px] text-ink-3">No description provided.</p>
            )}
          </section>

          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="mb-3 text-[13px] font-semibold text-ink-2">Assignees</h2>
            {siblings.isError ? (
              <ErrorState error={siblings.error} onRetry={siblings.refetch} />
            ) : siblings.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (enrichedTask?.assignments.length ?? 0) === 0 ? (
              <p className="text-[13px] text-ink-3">Nobody is assigned yet.</p>
            ) : (
              <ul className="space-y-2">
                {enrichedTask!.assignments.map((a) => (
                  <li key={a.userId} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={a.user.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink">{a.user.name}</span>
                        <span className="block truncate text-[11.5px] text-ink-3">{a.user.email}</span>
                      </span>
                    </span>
                    <button
                      onClick={() => unassign(a.userId, a.user.name)}
                      disabled={unassigning === a.userId}
                      className="flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] text-ink-3 hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                    >
                      <UserX className="size-3.5" /> Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {task && <CommentsSection taskId={task.id} />}
        </div>

        <div className="space-y-5">
          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="mb-3 text-[13px] font-semibold text-ink-2">Details</h2>
            {base.isLoading || !task ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            ) : (
              <dl className="space-y-3 text-[13px]">
                <div className="flex items-center justify-between">
                  <dt className="text-ink-3">Status</dt>
                  <dd>
                    <StatusBadge status={task.status} />
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-3">Priority</dt>
                  <dd>
                    <PriorityBadge priority={task.priority} />
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-3">Due date</dt>
                  <dd className={cn(overdue && "font-medium text-danger")}>
                    {task.dueDate ? formatDueDate(task.dueDate) : "No due date"}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1 text-ink-3">
                    <FolderKanban className="size-3.5" /> Project
                  </dt>
                  <dd>
                    <Link href={`/projects/${task.projectId}`} className="font-medium text-brand hover:underline">
                      {task.project.name}
                    </Link>
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-3">Created</dt>
                  <dd className="text-ink-2">{formatDateTime(task.createdAt)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-3">Updated</dt>
                  <dd className="text-ink-2">{formatDateTime(task.updatedAt)}</dd>
                </div>
              </dl>
            )}
          </section>
        </div>
      </div>

      {task && (
        <>
          <TaskFormDialog open={editOpen} onOpenChange={setEditOpen} task={task} />
          <AssignDialog
            open={assignOpen}
            onOpenChange={setAssignOpen}
            task={{
              id: task.id,
              projectId: task.projectId,
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              dueDate: task.dueDate,
              createdAt: task.createdAt,
              updatedAt: task.updatedAt,
              assignments: enrichedTask?.assignments ?? [],
            }}
          />
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title="Delete task?"
            description={`“${task.title}” will be permanently deleted.`}
            confirmLabel="Delete task"
            destructive
            loading={deleteTask.isPending}
            onConfirm={confirmDelete}
          />
        </>
      )}
    </div>
  );
}
