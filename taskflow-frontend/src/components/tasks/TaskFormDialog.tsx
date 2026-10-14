"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { Task, TaskPriority, TaskStatus, TaskWithProject } from "@/lib/api/types";
import { useAllProjects } from "@/hooks/use-projects";
import { useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { dateInputToIso, isoToDateInput } from "@/lib/utils";

export type TaskFormDialogHandle = {
  submit: () => Promise<void>;
};

export const TaskFormDialog = forwardRef<TaskFormDialogHandle, {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | TaskWithProject | null;
  defaultProjectId?: string;
  defaultStatus?: TaskStatus;
  onSaved?: (task: Task) => void;
  onDirtyChange?: (dirty: boolean) => void;
}>(({
  open,
  onOpenChange,
  task,
  defaultProjectId,
  defaultStatus,
  onSaved,
  onDirtyChange,
}, ref) => {
  const isEdit = !!task;
  const { data: projects, isLoading: projectsLoading } = useAllProjects();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const selectedProject = projects?.find((project) => project.id === projectId);
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);
  const create = useCreateTask();
  const update = useUpdateTask();
  const pending = create.isPending || update.isPending;
  const initialTitle = task?.title ?? "";
  const initialDescription = task?.description ?? "";
  const initialProjectId = task?.projectId ?? defaultProjectId ?? "";
  const initialStatus = task?.status ?? defaultStatus ?? "TODO";
  const initialPriority = task?.priority ?? "MEDIUM";
  const initialDueDate = task ? isoToDateInput(task.dueDate) : "";
  const dirty =
    open &&
    (title !== initialTitle ||
      description !== initialDescription ||
      projectId !== initialProjectId ||
      status !== initialStatus ||
      priority !== initialPriority ||
      dueDate !== initialDueDate);

  useEffect(() => {
    if (!dirty) return;
    function warnBeforeLeave(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [dirty]);

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  // Re-sync local form state from the task/defaults each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setProjectId(task?.projectId ?? defaultProjectId ?? "");
    setStatus(task?.status ?? defaultStatus ?? "TODO");
    setPriority(task?.priority ?? "MEDIUM");
    setDueDate(task ? isoToDateInput(task.dueDate) : "");
    setFieldErrors({});
  }, [open, task, defaultProjectId, defaultStatus]);

  const submit = useCallback(async () => {
    setFieldErrors({});
    const trimmedDescription = description.trim();
    try {
      if (isEdit && task) {
        const saved = await update.mutateAsync({
          id: task.id,
          input: {
            title: title.trim(),
            description: trimmedDescription === "" ? null : trimmedDescription,
            projectId,
            status,
            priority,
            dueDate: dueDate ? dateInputToIso(dueDate) : null,
          },
        });
        toast.success("Task updated");
        onSaved?.(saved as Task);
      } else {
        const saved = await create.mutateAsync({
          title: title.trim(),
          projectId,
          status,
          priority,
          ...(trimmedDescription && { description: trimmedDescription }),
          ...(dueDate && { dueDate: dateInputToIso(dueDate) }),
        });
        toast.success("Task created");
        onSaved?.(saved as Task);
      }

      setDiscardPromptOpen(false);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      } else {
        toast.error(errorMessage(err));
      }
    }
  }, [create, description, dueDate, isEdit, onOpenChange, onSaved, priority, projectId, status, task, title, update]);

  useImperativeHandle(ref, () => ({ submit }), [submit]);

  function requestClose() {
    if (pending) return;
    if (dirty) {
      setDiscardPromptOpen(true);
      return;
    }
    onOpenChange(false);
  }

  function discardChanges() {
    setDiscardPromptOpen(false);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) onOpenChange(true);
          else requestClose();
        }}
        title={isEdit ? "Edit task" : "Create new task"}
        description={isEdit ? "Update the task details in your workspace." : "Add a task to a project and keep ownership clear."}
        size="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={requestClose} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} loading={pending} disabled={!title.trim() || !projectId}>
              {isEdit ? "Save changes" : "Save task"}
            </Button>
          </>
        }
      >
      <div className="tf-task-form-layout">
        <div className="tf-task-form-fields">
          <div className="tf-task-form-section-title"><span>01 / TASK DETAILS</span><strong>{isEdit ? "Make an update" : "Start with the work"}</strong></div>
          <div>
          <Label htmlFor="task-title">Title</Label>
          <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} autoFocus />
          <FieldError>{fieldErrors.title?.[0]}</FieldError>
          </div>
          <div>
          <Label htmlFor="task-description">Description</Label>
          <Textarea
            id="task-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={10000}
          />
          <FieldError>{fieldErrors.description?.[0]}</FieldError>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="task-project">Project</Label>
            <Select
              id="task-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={projectsLoading || !!defaultProjectId}
            >
              <option value="" disabled>
                Select a project…
              </option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <FieldError>{fieldErrors.projectId?.[0]}</FieldError>
          </div>
          <div>
            <Label htmlFor="task-status">Status</Label>
            <Select id="task-status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              <option value="TODO">To do</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="REVIEW">Review</option>
              <option value="DONE">Done</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="task-priority">Priority</Label>
            <Select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="task-due">Due date</Label>
            <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <FieldError>{fieldErrors.dueDate?.[0]}</FieldError>
          </div>
          </div>
        </div>
        <aside className="tf-task-form-summary" aria-live="polite" aria-label="Task summary preview">
          <span className="tf-task-form-summary-label">LIVE SUMMARY</span>
          <h3>{title.trim() || "Untitled task"}</h3>
          <p>{description.trim() || "Your description will appear here."}</p>
          <dl>
            <div><dt>Project</dt><dd>{selectedProject?.name ?? (projectsLoading ? "Loading projects…" : "Choose a project")}</dd></div>
            <div><dt>Status</dt><dd>{status.replaceAll("_", " ")}</dd></div>
            <div><dt>Priority</dt><dd>{priority}</dd></div>
            <div><dt>Due date</dt><dd>{dueDate || "Not set"}</dd></div>
          </dl>
        </aside>
      </div>
      </Dialog>
      <Dialog
        open={discardPromptOpen}
        onOpenChange={setDiscardPromptOpen}
        title="Unsaved changes"
        description="You have unsaved changes. Do you want to save or discard them?"
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDiscardPromptOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={discardChanges} disabled={pending}>
              Discard
            </Button>
            <Button size="sm" onClick={() => void submit()} loading={pending} disabled={!title.trim() || !projectId}>
              Save
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-2">Save this task before closing the form?</p>
      </Dialog>
    </>
  );
});

TaskFormDialog.displayName = "TaskFormDialog";
