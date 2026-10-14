import type { TaskListParams } from "@/lib/api/types";

export const qk = {
  projects: {
    all: ["projects"] as const,
    list: (page: number, limit: number) => ["projects", "list", page, limit] as const,
    everything: () => ["projects", "list-all"] as const,
    detail: (id: string) => ["projects", "detail", id] as const,
    dashboard: (id: string) => ["projects", "dashboard", id] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    list: (params: TaskListParams) => ["tasks", "list", params] as const,
    count: (params: TaskListParams) => ["tasks", "count", params] as const,
    ofProject: (projectId: string) => ["tasks", "project-all", projectId] as const,
    detail: (id: string) => ["tasks", "detail", id] as const,
  },
  jobs: {
    detail: (id: string) => ["jobs", id] as const,
  },
  org: {
    detail: (orgId: string | null) => ["organizations", orgId, "me"] as const,
    members: (orgId: string | null) => ["organizations", orgId, "members"] as const,
    memberships: (orgId: string | null) => ["organizations", orgId, "memberships"] as const,
    invitations: (orgId: string | null) => ["organizations", orgId, "invitations"] as const,
  },
  user: {
    me: () => ["users", "me"] as const,
  },
  notifications: {
    all: () => ["notifications"] as const,
  },
  activity: {
    comments: (orgId: string | null, page: number, limit: number) => ["activity", orgId, "comments", page, limit] as const,
  },
  comments: {
    ofTask: (taskId: string) => ["comments", "task", taskId] as const,
  },
};
