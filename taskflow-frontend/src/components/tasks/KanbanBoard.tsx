"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SortableTaskCard, TaskCard } from "./TaskCard";
import { useDeleteTask, useMoveTask } from "@/hooks/use-tasks";
import type { Task, TaskStatus } from "@/lib/api/types";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

const COLUMNS: { status: TaskStatus; label: string; accent: string }[] = [
  { status: "TODO", label: "To do", accent: "bg-s-todo" },
  { status: "IN_PROGRESS", label: "In progress", accent: "bg-s-progress" },
  { status: "REVIEW", label: "Review", accent: "bg-s-review" },
  { status: "DONE", label: "Done", accent: "bg-s-done" },
];

function Column({
  status,
  label,
  accent,
  tasks,
  onAddTask,
  onEdit,
  onAssign,
  onDelete,
}: {
  status: TaskStatus;
  label: string;
  accent: string;
  tasks: Task[];
  onAddTask: (status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onAssign: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="tf-board-column flex w-[280px] shrink-0 flex-col md:w-full" data-status={status}>
      <div className="tf-board-column-heading">
        <span className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", accent)} />
          {label}
          <span className="tf-board-column-count">{tasks.length}</span>
        </span>
        <button
          onClick={() => onAddTask(status)}
          className="tf-board-add-task flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-ink-3 hover:bg-surface-2 hover:text-ink"
          aria-label={`Add task to ${label}`}
        >
          <Plus className="size-3.5" /> Add task
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "tf-neo-brutal-lane tf-board-column-list flex min-h-[120px] flex-1 flex-col gap-3 rounded-xl border border-line bg-surface-2/50 p-2 transition-colors",
          isOver && "border-brand/40 bg-brand-soft/40",
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              id={task.id}
              task={task}
              onEdit={() => onEdit(task)}
              onAssign={() => onAssign(task)}
              onDelete={() => onDelete(task)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <button
            onClick={() => onAddTask(status)}
            className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line py-6 text-[12px] text-ink-3 hover:border-line-strong hover:text-ink-2"
          >
            No tasks yet
          </button>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({
  tasks,
  onAddTask,
  onEdit,
  onAssign,
}: {
  tasks: Task[];
  onAddTask: (status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onAssign: (task: Task) => void;
}) {
  const moveTask = useMoveTask();
  const deleteTask = useDeleteTask();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Task | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] };
    for (const t of tasks) map[t.status].push(t);
    return map;
  }, [tasks]);

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;

    // `over.id` is either a column status (dropped on empty space) or another task's id.
    const overStatus = COLUMNS.some((c) => c.status === over.id)
      ? (over.id as TaskStatus)
      : tasks.find((t) => t.id === over.id)?.status;

    if (!overStatus || overStatus === task.status) return;

    try {
      await moveTask.mutateAsync({ id: task.id, status: overStatus });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deleteCandidate) return;
    try {
      await deleteTask.mutateAsync(deleteCandidate.id);
      toast.success("Task deleted");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteCandidate(null);
    }
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="tf-project-board grid auto-cols-[minmax(260px,82vw)] grid-flow-col gap-4 overflow-x-auto pb-4 md:auto-cols-auto md:grid-flow-row md:grid-cols-2 md:overflow-visible xl:grid-cols-4">
          {COLUMNS.map((col) => (
            <Column
              key={col.status}
              {...col}
              tasks={byStatus[col.status]}
              onAddTask={onAddTask}
              onEdit={onEdit}
              onAssign={onAssign}
              onDelete={setDeleteCandidate}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} onEdit={() => {}} onAssign={() => {}} onDelete={() => {}} />}
        </DragOverlay>
      </DndContext>

      <ConfirmDialog
        open={!!deleteCandidate}
        onOpenChange={(open) => !open && setDeleteCandidate(null)}
        title="Delete task?"
        description={`“${deleteCandidate?.title}” will be permanently deleted.`}
        confirmLabel="Delete task"
        destructive
        loading={deleteTask.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
