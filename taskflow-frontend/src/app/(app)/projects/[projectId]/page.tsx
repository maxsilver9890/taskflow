"use client";

import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { DashboardStats } from "@/components/analytics/DashboardStats";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { AssignDialog } from "@/components/tasks/AssignDialog";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { TaskFormDialog, type TaskFormDialogHandle } from "@/components/tasks/TaskFormDialog";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useDeleteProject, useProject, useProjectDashboard } from "@/hooks/use-projects";
import { useProjectTasks } from "@/hooks/use-tasks";
import type { Task, TaskStatus } from "@/lib/api/types";
import { errorMessage } from "@/lib/api/errors";
import { formatDueDate } from "@/lib/utils";

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const project = useProject(projectId);
  const dashboard = useProjectDashboard(projectId);
  const tasksQuery = useProjectTasks(projectId);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [assigningTask, setAssigningTask] = useState<Task | null>(null);
  const [taskFormDirty, setTaskFormDirty] = useState(false);
  const [leavePromptOpen, setLeavePromptOpen] = useState(false);
  const [leaveAfterTaskClose, setLeaveAfterTaskClose] = useState(false);
  const taskFormRef = useRef<TaskFormDialogHandle>(null);

  const deleteProject = useDeleteProject();

  useEffect(() => {
    if (!taskFormOpen && leaveAfterTaskClose) {
      router.push("/projects");
    }
  }, [taskFormOpen, leaveAfterTaskClose, router]);

  useEffect(() => {
    if (!taskFormOpen || !taskFormDirty) return;

    window.history.pushState({ taskFormGuard: true }, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState({ taskFormGuard: true }, "", window.location.href);
      setLeavePromptOpen(true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [taskFormOpen, taskFormDirty]);

  function requestProjectBack() {
    if (!taskFormOpen) {
      router.push("/projects");
      return;
    }
    if (taskFormDirty) {
      setLeavePromptOpen(true);
      return;
    }
    setLeaveAfterTaskClose(true);
    setTaskFormOpen(false);
  }

  function openAddTask(status: TaskStatus) {
    router.push(`/tasks/new?projectId=${encodeURIComponent(projectId)}&status=${status}&from=project`);
  }
  function openEditTask(task: Task) {
    setEditingTask(task);
    setTaskFormOpen(true);
  }

  async function confirmDeleteProject() {
    try {
      await deleteProject.mutateAsync(projectId);
      toast.success("Project deleted");
      router.replace("/projects");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  if (project.isError) {
    return (
      <div>
        <PageHeader title="Project" />
        <div className="p-4 md:p-6">
          <ErrorState error={project.error} onRetry={project.refetch} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="tf-project-detail-hero">
        <div className="tf-project-detail-copy">
          <button onClick={requestProjectBack} aria-label="Back to projects" className="tf-project-back">
            <ArrowLeft className="size-4" /> All projects
          </button>
          <span className="tf-projects-eyebrow">Workspace / Project board</span>
          {project.isLoading ? <Skeleton className="h-10 w-64" /> : <h1>{project.data?.name}</h1>}
          {project.data?.description && <p>{project.data.description}</p>}
          {project.data && <span className="tf-project-created">Created {formatDueDate(project.data.createdAt)}</span>}
        </div>
        <div className="tf-project-detail-actions">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" /> Edit project
          </Button>
          <Button variant="outline" size="icon" aria-label="Delete project" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
          </Button>
          <Button size="sm" onClick={() => openAddTask("TODO")}>
            <Plus className="size-4" /> New task
          </Button>
        </div>
        <span className="tf-project-detail-code" aria-hidden="true">TF / BOARD</span>
      </header>

      <div className="tf-project-detail-content space-y-6 p-4 md:p-6">

        {dashboard.isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : dashboard.data ? (
          <DashboardStats dashboard={dashboard.data} />
        ) : null}

        <div className="tf-board-section-head">
          <div>
            <span className="tf-projects-eyebrow">Execution view</span>
            <h2>TASK BOARD</h2>
          </div>
          <p>Move tasks between stages to keep the project current.</p>
        </div>

        {tasksQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : tasksQuery.isError ? (
          <ErrorState error={tasksQuery.error} onRetry={tasksQuery.refetch} />
        ) : (
          <>
            <KanbanBoard
              tasks={tasksQuery.data?.tasks ?? []}
              onAddTask={openAddTask}
              onEdit={openEditTask}
              onAssign={setAssigningTask}
            />
            {tasksQuery.data?.truncated && (
              <p className="text-center text-[12px] text-ink-3">
                Showing the first 500 tasks. Use the All tasks page with filters to see the rest.
              </p>
            )}
          </>
        )}
      </div>

      {project.data && <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={project.data} />}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete project?"
        description={`This permanently deletes “${project.data?.name}” and all of its tasks. This cannot be undone.`}
        confirmLabel="Delete project"
        destructive
        loading={deleteProject.isPending}
        onConfirm={confirmDeleteProject}
      />

      <TaskFormDialog
        ref={taskFormRef}
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        task={editingTask}
        defaultProjectId={projectId}
        onDirtyChange={setTaskFormDirty}
      />

      <Dialog
        open={leavePromptOpen}
        onOpenChange={setLeavePromptOpen}
        title="Unsaved changes"
        description="You have unsaved changes. Do you want to save or discard them before leaving?"
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setLeavePromptOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setLeavePromptOpen(false);
                setTaskFormDirty(false);
                setTaskFormOpen(false);
                router.push("/projects");
              }}
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setLeavePromptOpen(false);
                setLeaveAfterTaskClose(true);
                void taskFormRef.current?.submit();
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-2">Save this task before leaving the project?</p>
      </Dialog>

      {assigningTask && (
        <AssignDialog open={!!assigningTask} onOpenChange={(open) => !open && setAssigningTask(null)} task={assigningTask} />
      )}
    </div>
  );
}
