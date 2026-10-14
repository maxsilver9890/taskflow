"use client";

import { ArrowLeft, CalendarDays, Check, ClipboardList, FolderKanban, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ErrorState } from "@/components/ui/States";
import { useAllProjects } from "@/hooks/use-projects";
import { useCreateTask } from "@/hooks/use-tasks";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "@/lib/api/types";
import { dateInputToIso } from "@/lib/utils";

const statusLabels: Record<TaskStatus, string> = { TODO: "To do", IN_PROGRESS: "In progress", REVIEW: "Review", DONE: "Done" };
const priorityLabels: Record<TaskPriority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };
const getStatus = (value: string | null): TaskStatus => TASK_STATUSES.find((status) => status === value) ?? "TODO";
const getPriority = (value: string): TaskPriority => TASK_PRIORITIES.find((priority) => priority === value) ?? "MEDIUM";

export default function NewTaskPage() {
  return <Suspense fallback={null}><NewTaskPageContent /></Suspense>;
}

function NewTaskPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projects = useAllProjects();
  const createTask = useCreateTask();
  const from = searchParams.get("from");
  const requestedProjectId = searchParams.get("projectId") ?? "";
  const initialStatus = getStatus(searchParams.get("status"));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(requestedProjectId);
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [leaveTo, setLeaveTo] = useState<string | null>(null);

  const requestedProjectIsValid = projects.isLoading || projects.data?.some((item) => item.id === requestedProjectId) === true;
  const selectedProjectId = requestedProjectId && !requestedProjectIsValid && projectId === requestedProjectId ? "" : projectId;
  const project = projects.data?.find((item) => item.id === selectedProjectId);
  const initialProjectId = projects.isLoading || projects.data?.some((item) => item.id === requestedProjectId) ? requestedProjectId : "";
  const dirty = Boolean(title.trim() || description.trim() || dueDate || priority !== "MEDIUM" || status !== initialStatus || selectedProjectId !== initialProjectId);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [dirty]);

  const returnPath = useMemo(() => {
    if (from === "tasks") return "/tasks";
    if (from === "project" && project) return `/projects/${project.id}`;
    return "/dashboard";
  }, [from, project]);

  function requestLeave(path: string) {
    if (dirty) setLeaveTo(path);
    else router.push(path);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    if (!title.trim()) {
      setFieldErrors({ title: ["Title is required"] });
      return;
    }
    if (!selectedProjectId || !project) {
      setFieldErrors({ projectId: ["Choose a project for this task"] });
      return;
    }

    try {
      await createTask.mutateAsync({
        title: title.trim(),
        projectId: selectedProjectId,
        status,
        priority,
        ...(description.trim() && { description: description.trim() }),
        ...(dueDate && { dueDate: dateInputToIso(dueDate) }),
      });
      toast.success("Task created");
      router.push(returnPath);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) setFieldErrors(error.fieldErrors);
      else toast.error(errorMessage(error));
    }
  }

  return (
    <div className="tf-create-task-page">
      <header className="tf-create-task-head">
        <div>
          <div className="tf-create-task-navigation">
            <Link href="/dashboard" onClick={(event) => { event.preventDefault(); requestLeave("/dashboard"); }} className="tf-create-task-back">
              <ArrowLeft className="size-4" /> Back to dashboard
            </Link>
            {from === "tasks" && <button type="button" onClick={() => requestLeave("/tasks")} className="tf-create-task-context-back">Back to all tasks</button>}
            {from === "project" && project && <button type="button" onClick={() => requestLeave(`/projects/${project.id}`)} className="tf-create-task-context-back">Back to {project.name}</button>}
          </div>
          <span className="tf-projects-eyebrow">Workspace / Task creation</span>
          <h1>CREATE NEW TASK</h1>
          <p>Give the work a clear owner, place, and next step.</p>
        </div>
        <div className="tf-create-task-mark" aria-hidden="true"><Plus className="size-8" /><span>TASK / 01</span></div>
      </header>

      <main className="tf-create-task-layout">
        <section className="tf-create-task-form-panel" aria-labelledby="create-task-form-title">
          <div className="tf-create-task-section-title"><span>01 / TASK DETAILS</span><h2 id="create-task-form-title">Put the work in motion</h2></div>
          {projects.isError ? <ErrorState error={projects.error} onRetry={projects.refetch} /> : (
            <form onSubmit={submit} className="tf-create-task-form">
              <div>
                <Label htmlFor="create-task-title">Task title</Label>
                <Input id="create-task-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} placeholder="What needs to get done?" autoFocus />
                <FieldError>{fieldErrors.title?.[0]}</FieldError>
              </div>
              <div>
                <Label htmlFor="create-task-description">Description</Label>
                <Textarea id="create-task-description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={10000} placeholder="Add useful context for the people doing the work." />
                <FieldError>{fieldErrors.description?.[0]}</FieldError>
              </div>
              <div className="tf-create-task-fields-grid">
                <div className="sm:col-span-2">
                  <Label htmlFor="create-task-project">Project</Label>
                  <Select id="create-task-project" value={selectedProjectId} onChange={(event) => setProjectId(event.target.value)} disabled={projects.isLoading || (from === "project" && !!selectedProjectId)}>
                    <option value="">{projects.isLoading ? "Loading projects…" : "Choose a project"}</option>
                    {projects.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </Select>
                  <FieldError>{fieldErrors.projectId?.[0]}</FieldError>
                </div>
                <div>
                  <Label htmlFor="create-task-status">Status</Label>
                  <Select id="create-task-status" value={status} onChange={(event) => setStatus(getStatus(event.target.value))}>
                    {TASK_STATUSES.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="create-task-priority">Priority</Label>
                  <Select id="create-task-priority" value={priority} onChange={(event) => setPriority(getPriority(event.target.value))}>
                    {TASK_PRIORITIES.map((value) => <option key={value} value={value}>{priorityLabels[value]}</option>)}
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="create-task-due-date">Due date</Label>
                  <Input id="create-task-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                  <FieldError>{fieldErrors.dueDate?.[0]}</FieldError>
                </div>
              </div>
              <div className="tf-create-task-actions">
                <Button type="button" variant="outline" size="lg" onClick={() => requestLeave(returnPath)}>Cancel</Button>
                <Button type="submit" size="lg" loading={createTask.isPending} disabled={!title.trim() || !selectedProjectId || !project}><Check className="size-4" /> Create task</Button>
              </div>
            </form>
          )}
        </section>

        <aside className="tf-create-task-aside">
          <section className="tf-create-task-preview" aria-live="polite" aria-label="Task preview">
            <span className="tf-create-task-aside-label">LIVE PREVIEW</span>
            <div className="tf-create-task-preview-icon"><ClipboardList className="size-5" /></div>
            <h2>{title.trim() || "Your task title"}</h2>
            <p>{description.trim() || "A clear description helps your team move work forward."}</p>
            <div className="tf-create-task-preview-meta"><span>{statusLabels[status]}</span><span>{priorityLabels[priority]} priority</span></div>
          </section>
          <section className="tf-create-task-project-card">
            <span className="tf-create-task-aside-label">PROJECT CONTEXT</span>
            <FolderKanban className="mt-5 size-6" />
            <h3>{project?.name ?? (projects.isLoading ? "Loading projects…" : "Choose a project")}</h3>
            <p>{project?.description || (project ? "No project description yet." : "Your task will live inside the selected project.")}</p>
            {dueDate && <span className="tf-create-task-date"><CalendarDays className="size-4" /> Due {new Date(`${dueDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>}
          </section>
          <p className="tf-create-task-note">Task updates and assignments remain connected to your organization workspace.</p>
        </aside>
      </main>

      <Dialog
        open={!!leaveTo}
        onOpenChange={(open) => !open && setLeaveTo(null)}
        title="Leave this task?"
        description="Your task details will be lost if you leave now."
        size="sm"
        footer={<>
          <Button variant="outline" onClick={() => setLeaveTo(null)}>Keep editing</Button>
          <Button variant="danger" onClick={() => leaveTo && router.push(leaveTo)}>Discard changes</Button>
        </>}
      >
        <p className="text-sm text-ink-2">This task has not been saved.</p>
      </Dialog>
    </div>
  );
}
