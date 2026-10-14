"use client";

import { ListX, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AssignDialog } from "@/components/tasks/AssignDialog";
import { TaskFilters, type TaskFilterState } from "@/components/tasks/TaskFilters";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { TaskTable } from "@/components/tasks/TaskTable";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useAllProjects } from "@/hooks/use-projects";
import { useOrgMembers } from "@/hooks/use-organization";
import { useDeleteTask, useTaskList } from "@/hooks/use-tasks";
import type { Task, TaskListParams } from "@/lib/api/types";
import { errorMessage } from "@/lib/api/errors";
import { dateInputToIso, isOverdue, startOfTodayIso } from "@/lib/utils";

const LIMIT = 20;

export default function TasksPage() {
  return (
    <Suspense fallback={null}>
      <TasksPageInner />
    </Suspense>
  );
}

function TasksPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<TaskFilterState>(() => ({
    projectId: searchParams.get("projectId") ?? "",
    status: (searchParams.get("status") as TaskFilterState["status"]) ?? "",
    priority: (searchParams.get("priority") as TaskFilterState["priority"]) ?? "",
    assignee: searchParams.get("assignee") ?? "",
    dueFrom: searchParams.get("dueFrom") ?? "",
    dueTo: searchParams.get("dueTo") ?? "",
    overdue: searchParams.get("overdue") === "1",
  }));
  const [page, setPage] = useState(1);

  function updateFilters(next: TaskFilterState) {
    setFilters(next);
    setPage(1);
  }

  // Keep the URL shareable/bookmarkable without triggering full navigations.
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.projectId) params.set("projectId", filters.projectId);
    if (filters.status) params.set("status", filters.status);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.assignee) params.set("assignee", filters.assignee);
    if (filters.dueFrom) params.set("dueFrom", filters.dueFrom);
    if (filters.dueTo) params.set("dueTo", filters.dueTo);
    if (filters.overdue) params.set("overdue", "1");
    router.replace(params.size ? `/tasks?${params}` : "/tasks", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const apiParams: TaskListParams = useMemo(() => {
    const p: TaskListParams = { page, limit: LIMIT };
    if (filters.projectId) p.projectId = filters.projectId;
    if (filters.status) p.status = filters.status;
    if (filters.priority) p.priority = filters.priority;
    if (filters.assignee) p.assignee = filters.assignee;
    if (filters.dueFrom) p.dueFrom = dateInputToIso(filters.dueFrom);
    if (filters.dueTo) p.dueTo = dateInputToIso(filters.dueTo);
    if (filters.overdue && !filters.dueTo) p.dueTo = startOfTodayIso();
    return p;
  }, [filters, page]);

  const tasksQuery = useTaskList(apiParams);
  const { data: allProjects } = useAllProjects();
  const { members } = useOrgMembers();
  const projectsById = useMemo(() => new Map((allProjects ?? []).map((p) => [p.id, p])), [allProjects]);

  const visibleTasks = useMemo(() => {
    const rows = tasksQuery.data?.data ?? [];
    return filters.overdue ? rows.filter((t) => isOverdue(t.dueDate, t.status === "DONE")) : rows;
  }, [tasksQuery.data, filters.overdue]);

  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [assigningTask, setAssigningTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const deleteTask = useDeleteTask();

  function openCreate() {
    setEditingTask(null);
    setTaskFormOpen(true);
  }
  function openEdit(task: Task) {
    setEditingTask(task);
    setTaskFormOpen(true);
  }

  async function confirmDelete() {
    if (!deletingTask) return;
    try {
      await deleteTask.mutateAsync(deletingTask.id);
      toast.success("Task deleted");
      setDeletingTask(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div>
      <div className="tf-task-index-page space-y-5 p-4 md:p-6">
        <section className="tf-task-index-head">
          <div>
            <span className="tf-projects-eyebrow">Work queue / Organization</span>
            <h1>ALL TASKS</h1>
            <p>{tasksQuery.isLoading ? "Loading tasks…" : `${tasksQuery.data?.total ?? 0} matching tasks`}</p>
          </div>
          <Button size="md" onClick={openCreate}>
            <Plus className="size-4" /> New task
          </Button>
        </section>

        <TaskFilters filters={filters} onChange={updateFilters} projects={allProjects ?? []} members={members} />

        {tasksQuery.isError ? (
          <ErrorState error={tasksQuery.error} onRetry={tasksQuery.refetch} />
        ) : !tasksQuery.isLoading && visibleTasks.length === 0 ? (
          <EmptyState
            icon={<ListX className="size-5" />}
            title="No tasks match these filters"
            description="Try widening your filters, or create a new task."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" /> New task
              </Button>
            }
          />
        ) : (
          <>
            <TaskTable
              tasks={visibleTasks}
              projectsById={projectsById}
              onEdit={openEdit}
              onAssign={setAssigningTask}
              onDelete={setDeletingTask}
              loading={tasksQuery.isLoading}
            />
            {!filters.overdue && tasksQuery.data && (
              <div className="tf-task-pagination">
                <Pagination page={page} limit={LIMIT} total={tasksQuery.data.total} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>

      <TaskFormDialog open={taskFormOpen} onOpenChange={setTaskFormOpen} task={editingTask} />

      {assigningTask && (
        <AssignDialog open={!!assigningTask} onOpenChange={(open) => !open && setAssigningTask(null)} task={assigningTask} />
      )}

      <ConfirmDialog
        open={!!deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(null)}
        title="Delete task?"
        description={`“${deletingTask?.title}” will be permanently deleted.`}
        confirmLabel="Delete task"
        destructive
        loading={deleteTask.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
