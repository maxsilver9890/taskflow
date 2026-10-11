"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { ApiError } from "@/lib/api/errors";
import { fetchAllTasks, tasksApi } from "@/lib/api/services";
import type {
  AssigneeUser,
  CreateTaskInput,
  Task,
  TaskListParams,
  TaskWithProject,
  UpdateTaskInput,
} from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { addJobLogEntry } from "@/lib/job-log";
import { qk } from "@/lib/query-keys";

export function useTaskList(params: TaskListParams) {
  return useQuery({
    queryKey: qk.tasks.list(params),
    queryFn: () => tasksApi.list(params),
    placeholderData: keepPreviousData,
  });
}

/** Cheap "how many match?" query – asks for one row and reads `total`. */
export function useTaskCount(params: Omit<TaskListParams, "page" | "limit">, enabled = true) {
  const p: TaskListParams = { ...params, page: 1, limit: 1 };
  return useQuery({
    queryKey: qk.tasks.count(p),
    queryFn: () => tasksApi.list(p),
    select: (res) => res.total,
    enabled,
  });
}

/** All tasks of one project (up to 500) – powers the board and analytics. */
export function useProjectTasks(projectId: string) {
  return useQuery({
    queryKey: qk.tasks.ofProject(projectId),
    queryFn: () => fetchAllTasks({ projectId }),
    enabled: !!projectId,
  });
}

/**
 * Task detail. GET /tasks/:id returns the task + project but not assignees,
 * so assignees are read from the project's task list (which includes them).
 */
export function useTaskDetail(taskId: string) {
  const base = useQuery({
    queryKey: qk.tasks.detail(taskId),
    queryFn: () => tasksApi.get(taskId),
    retry: (count, err) => !(err instanceof ApiError && [403, 404].includes(err.status)) && count < 2,
  });
  const projectId = base.data?.projectId ?? "";
  const siblings = useProjectTasks(projectId);
  const enrichedTask = siblings.data?.tasks.find((t) => t.id === taskId) ?? null;
  return { base, siblings, enrichedTask };
}

// ── Cache helpers ────────────────────────────────────────────────────────────

type TaskCacheShape = { data: Task[] } | { tasks: Task[] } | TaskWithProject | unknown;

function mapTasks(value: TaskCacheShape, fn: (t: Task) => Task | null): TaskCacheShape {
  if (value && typeof value === "object") {
    if ("data" in value && Array.isArray((value as { data: unknown }).data)) {
      const v = value as { data: Task[]; total?: number };
      const next = v.data.map(fn).filter((t): t is Task => t !== null);
      return { ...v, data: next, total: typeof v.total === "number" ? v.total - (v.data.length - next.length) : v.total };
    }
    if ("tasks" in value && Array.isArray((value as { tasks: unknown }).tasks)) {
      const v = value as { tasks: Task[]; total: number };
      const next = v.tasks.map(fn).filter((t): t is Task => t !== null);
      return { ...v, tasks: next, total: v.total - (v.tasks.length - next.length) };
    }
  }
  return value;
}

export function patchTaskInCaches(qc: QueryClient, taskId: string, patch: Partial<Task>) {
  qc.setQueriesData({ queryKey: qk.tasks.all }, (old: TaskCacheShape) =>
    mapTasks(old, (t) => (t.id === taskId ? { ...t, ...patch } : t)),
  );
}

export function snapshotTaskCaches(qc: QueryClient) {
  return qc.getQueriesData({ queryKey: qk.tasks.all });
}

export function restoreTaskCaches(qc: QueryClient, snapshot: ReturnType<typeof snapshotTaskCaches>) {
  for (const [key, data] of snapshot) qc.setQueryData(key, data);
}

function invalidateAfterTaskChange(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.tasks.all });
  qc.invalidateQueries({ queryKey: ["projects", "dashboard"] });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => tasksApi.create(input),
    onSuccess: () => invalidateAfterTaskChange(qc),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) => tasksApi.update(id, input),
    onSuccess: () => invalidateAfterTaskChange(qc),
  });
}

/** Optimistic status change for drag-and-drop; rolls back if the API rejects it. */
export function useMoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Task["status"] }) =>
      tasksApi.update(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: qk.tasks.all });
      const snapshot = snapshotTaskCaches(qc);
      patchTaskInCaches(qc, id, { status });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) restoreTaskCaches(qc, ctx.snapshot);
    },
    onSettled: () => invalidateAfterTaskChange(qc),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => invalidateAfterTaskChange(qc),
  });
}

export function useAssignTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ task, assignee }: { task: { id: string; title: string }; assignee: AssigneeUser }) => {
      const result = await tasksApi.assign(task.id, assignee.id);
      return { result, task, assignee };
    },
    onSuccess: ({ result, task, assignee }) => {
      if (result.jobId && user) {
        addJobLogEntry(user.id, {
          jobId: result.jobId,
          taskId: task.id,
          taskTitle: task.title,
          assigneeName: assignee.name,
          assigneeEmail: assignee.email,
          createdAt: result.createdAt,
        });
      }
      invalidateAfterTaskChange(qc);
    },
  });
}

export function useUnassignTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, userId }: { taskId: string; userId: string }) => tasksApi.unassign(taskId, userId),
    onSuccess: () => invalidateAfterTaskChange(qc),
  });
}
