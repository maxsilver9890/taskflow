
import { api, apiWithAccessToken } from "./client";
import type {
  AssignmentResult,
  Comment,
  CommentActivityResponse,
  CreateCommentInput,
  CreateProjectInput,
  CreateTaskInput,
  ForgotPasswordInput,
  FirebaseExchangeInput,
  FirebaseExchangeResponse,
  FirebaseLinkInput,
  JobInfo,
  LoginInput,
  LoginResponse,
  OrganizationMembersResponse,
  OrganizationInvitationsResponse,
  OrganizationInvitation,
  PublicOrganizationInvitation,
  CreateOrganizationInput,
  CreatedOrganization,
  OrganizationMember,
  OrgRole,
  InviteOrganizationMemberInput,
  OrganizationMembershipsResponse,
  OrganizationSummary,
  Paginated,
  Project,
  ProjectDashboard,
  RegisterInput,
  RegisterResponse,
  ResendVerificationResponse,
  SelectOrganizationResponse,
  ResetPasswordInput,
  Task,
  TaskBase,
  TaskListParams,
  TaskWithProject,
  UpdateCommentInput,
  UpdateProjectInput,
  UpdateTaskInput,
  ChangePasswordInput,
  UpdateProfileInput,
  UserProfile,
  NotificationsResponse,
  VerifyEmailInput,
  VerifyEmailResponse,
  VerifyRegistrationInput,
  VerifyRegistrationResponse,
} from "./types";

// ── Auth (public endpoints) ──────────────────────────────────────────────────

export const authApi = {
  login: (input: LoginInput) =>
    api<LoginResponse>("/auth/login", { method: "POST", body: input, anonymous: true }),
  firebaseExchange: (input: FirebaseExchangeInput) =>
    api<FirebaseExchangeResponse>("/auth/firebase-exchange", { method: "POST", body: input, anonymous: true }),
  linkFirebase: (input: FirebaseLinkInput, accessToken: string) =>
    apiWithAccessToken<{ linked: boolean; alreadyLinked: boolean }>(
      "/auth/firebase-link",
      { method: "POST", body: input },
      accessToken,
    ),
  register: (input: RegisterInput) =>
    api<RegisterResponse>("/auth/register", { method: "POST", body: input, anonymous: true }),
  verifyRegistration: (input: VerifyRegistrationInput) =>
    api<VerifyRegistrationResponse>("/auth/verify-registration", { method: "POST", body: input, anonymous: true }),
  resendRegistration: (email: string) =>
    api<{ message: string; cooldownSeconds: number }>("/auth/resend-registration", { method: "POST", body: { email }, anonymous: true }),
  logout: (refreshToken: string) =>
    api<{ message: string }>("/auth/logout", { method: "POST", body: { refreshToken }, anonymous: true }),
  forgotPassword: (input: ForgotPasswordInput) =>
    api<{ message: string }>("/auth/forgot-password", { method: "POST", body: input, anonymous: true }),
  resetPassword: (input: ResetPasswordInput) =>
    api<{ message: string }>("/auth/reset-password", { method: "POST", body: input, anonymous: true }),
  selectOrganization: (organizationId: string) =>
    api<SelectOrganizationResponse>("/auth/select-org", { method: "POST", body: { organizationId } }),
  // Authenticated: these act on the signed-in caller's account.
  verifyEmail: (input: VerifyEmailInput) =>
    api<VerifyEmailResponse>("/auth/verify-email", { method: "POST", body: input }),
  resendVerification: () =>
    api<ResendVerificationResponse>("/auth/resend-verification", { method: "POST", body: {} }),
};

// ── Organizations ────────────────────────────────────────────────────────────

export const organizationsApi = {
  create: (input: CreateOrganizationInput) =>
    api<CreatedOrganization>("/organizations", { method: "POST", body: input }),
  get: () => api<OrganizationSummary>("/organizations/me"),
  members: () => api<OrganizationMembersResponse>("/organizations/me/members"),
  memberships: () => api<OrganizationMembershipsResponse>("/users/me/organizations"),
  invite: (input: InviteOrganizationMemberInput) =>
    api<OrganizationInvitation>("/organizations/me/invitations", { method: "POST", body: input }),
  getInvitation: (token: string) =>
    api<PublicOrganizationInvitation>(`/organizations/invitations/${encodeURIComponent(token)}`, { anonymous: true }),

  acceptInvitation: (token: string) =>
    api<{ organizationId: string; role: OrgRole }>(
      `/organizations/invitations/${encodeURIComponent(token)}/accept`,
      { method: "POST" },
    ),

  rejectInvitation: (token: string) =>
    api<{ success: boolean }>(
      `/organizations/invitations/${encodeURIComponent(token)}/reject`,
      { method: "POST" },
    ),

  updateMemberRole: (userId: string, role: OrgRole) =>
    api<OrganizationMember>(`/organizations/me/members/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: { role },
    }),
  removeMember: (userId: string) =>
    api<void>(`/organizations/me/members/${encodeURIComponent(userId)}`, { method: "DELETE" }),
  invitations: () => api<OrganizationInvitationsResponse>("/organizations/me/invitations"),
  cancelInvitation: (id: string) =>
    api<void>(`/organizations/me/invitations/${encodeURIComponent(id)}`, { method: "DELETE" }),
  leave: () => api<void>("/organizations/me/membership", { method: "DELETE" }),
  transferAdmin: (userId: string) =>
    api<{ organizationId: string; previousAdminId: string; newAdminId: string }>("/organizations/me/transfer-admin", {
      method: "POST",
      body: { userId },
    }),
  removeOrganization: () => api<void>("/organizations/me", { method: "DELETE" }),
};

export const notificationsApi = {
  list: () => api<NotificationsResponse>("/notifications"),
  markRead: (id: string) => api<void>(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }),
  markAllRead: () => api<void>("/notifications/read-all", { method: "POST" }),
};

export const activityApi = {
  comments: (page = 1, limit = 30) =>
    api<CommentActivityResponse>("/activity/comments", { query: { page, limit } }),
};

export const usersApi = {
  me: () => api<UserProfile>("/users/me"),
  updateMe: (input: UpdateProfileInput) =>
    api<UserProfile>("/users/me", { method: "PATCH", body: input }),
  changePassword: (input: ChangePasswordInput) =>
    api<{ message: string }>("/users/me/change-password", { method: "POST", body: input }),
};

// ── Comments ─────────────────────────────────────────────────────────────────

export const commentsApi = {
  list: (taskId: string, page = 1, limit = 50) =>
    api<Paginated<Comment>>(`/tasks/${taskId}/comments`, { query: { page, limit } }),
  create: (taskId: string, input: CreateCommentInput) =>
    api<Comment>(`/tasks/${taskId}/comments`, { method: "POST", body: input }),
  update: (taskId: string, commentId: string, input: UpdateCommentInput) =>
    api<Comment>(`/tasks/${taskId}/comments/${commentId}`, { method: "PATCH", body: input }),
  remove: (taskId: string, commentId: string) =>
    api<void>(`/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" }),
};

// ── Health ───────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => api<{ status: "ok" | "unavailable" }>("/health", { anonymous: true }),
};

// ── Projects ─────────────────────────────────────────────────────────────────

export const projectsApi = {
  list: (page = 1, limit = 20) =>
    api<Paginated<Project>>("/projects", { query: { page, limit } }),
  get: (id: string) => api<Project>(`/projects/${id}`),
  create: (input: CreateProjectInput) =>
    api<Project>("/projects", { method: "POST", body: input }),
  update: (id: string, input: UpdateProjectInput) =>
    api<Project>(`/projects/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) => api<void>(`/projects/${id}`, { method: "DELETE" }),
  dashboard: (id: string) => api<ProjectDashboard>(`/projects/${id}/dashboard`),
};

// ── Tasks ────────────────────────────────────────────────────────────────────

export const tasksApi = {
  list: (params: TaskListParams = {}) =>
    api<Paginated<Task>>("/tasks", { query: { ...params } }),
  get: (id: string) => api<TaskWithProject>(`/tasks/${id}`),
  create: (input: CreateTaskInput) =>
    api<TaskBase>("/tasks", { method: "POST", body: input }),
  update: (id: string, input: UpdateTaskInput) =>
    api<TaskBase>(`/tasks/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) => api<void>(`/tasks/${id}`, { method: "DELETE" }),
  assign: (taskId: string, userId: string) =>
    api<AssignmentResult>(`/tasks/${taskId}/assign`, { method: "POST", body: { userId } }),
  unassign: (taskId: string, userId: string) =>
    api<void>(`/tasks/${taskId}/assign/${userId}`, { method: "DELETE" }),
};

// ── Jobs ─────────────────────────────────────────────────────────────────────

export const jobsApi = {
  get: (id: string) => api<JobInfo>(`/jobs/${encodeURIComponent(id)}`),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 100;
const MAX_PAGES = 5;

/**
 * Loads every task matching the filters by walking pages of 100 (the API's max).
 * Capped at MAX_PAGES to keep boards/analytics responsive; `truncated` reports
 * whether more tasks exist than were loaded.
 */
export async function fetchAllTasks(
  params: Omit<TaskListParams, "page" | "limit"> = {},
): Promise<{ tasks: Task[]; total: number; truncated: boolean }> {
  const first = await tasksApi.list({ ...params, page: 1, limit: PAGE_LIMIT });
  const tasks = [...first.data];
  const totalPages = Math.ceil(first.total / PAGE_LIMIT);
  const lastPage = Math.min(totalPages, MAX_PAGES);

  if (lastPage > 1) {
    const rest = await Promise.all(
      Array.from({ length: lastPage - 1 }, (_, i) =>
        tasksApi.list({ ...params, page: i + 2, limit: PAGE_LIMIT }),
      ),
    );
    for (const page of rest) tasks.push(...page.data);
  }

  return { tasks, total: first.total, truncated: totalPages > MAX_PAGES };
}
