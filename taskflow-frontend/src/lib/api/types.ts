/**
 * Types mirror the backend contract exactly (see taskflow-backend src/**).
 * Prisma serialises enums by their TypeScript name (TODO, IN_PROGRESS, ...)
 * and dates as ISO strings.
 */

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type OrgRole = "ORG_ADMIN" | "MEMBER";

// ── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  /**
   * False immediately after registration until POST /auth/verify-email
   * succeeds. Absent on responses that predate this field (treat as
   * verified — see AuthProvider, which derives the authoritative value from
   * the access token's `emailVerified` claim instead of this field).
   */
  emailVerified?: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}

/** POST /auth/login */
export interface LoginResponse extends TokenPair {
  user: AuthUser;
}

/** POST /auth/firebase-exchange */
export interface FirebaseExchangeInput {
  idToken: string;
  name?: string;
  organizationName?: string;
}

export interface FirebaseExchangeResponse extends TokenPair {
  user: AuthUser;
  organization: { id: string; name: string };
}

export interface OrganizationMembership {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: OrgRole;
}

export interface OrganizationMembershipsResponse {
  data: OrganizationMembership[];
  total: number;
}

export interface ActiveOrganization {
  id: string;
  name: string;
  role: OrgRole;
}

export interface SelectOrganizationResponse extends TokenPair {
  organization: ActiveOrganization;
}

/** POST /auth/register — creates a pending registration only. */
export interface RegisterResponse {
  message: string;
  email: string;
  expiresInMinutes: number;
  /** Present only for recovery of an account created by the old flow. */
  legacyRecovery?: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokenType?: "Bearer";
  expiresIn?: number;
  user?: AuthUser;
  organization?: { id: string; name: string };
}

export interface VerifyRegistrationInput { email: string; otp: string }
export interface ResendRegistrationInput { email: string }
export interface VerifyRegistrationResponse extends TokenPair {
  message: string;
  user: AuthUser & { createdAt: string; emailVerified: true };
  organization: { id: string; name: string };
}

/** POST /auth/refresh */
export type RefreshResponse = TokenPair;

export interface LoginInput {
  email: string;
  password: string;
}
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  organization: {
    id: string;
    name: string;
    role: OrgRole;
  };
}
export interface UpdateProfileInput {
  name: string;
}
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
export interface RegisterInput {
  email: string;
  name: string;
  password: string;
  organizationName: string;
}
export interface ForgotPasswordInput {
  email: string;
}
export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface VerifyEmailInput {
  otp: string;
}

/** POST /auth/verify-email — a fresh token pair with emailVerified: true baked in. */
export interface VerifyEmailResponse extends TokenPair {
  message: string;
}

/** POST /auth/resend-verification */
export interface ResendVerificationResponse {
  message: string;
  /** Seconds to wait before the next resend is allowed. */
  cooldownSeconds: number;
}

// ── Projects ────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ProjectDashboard {
  projectId: string;
  counts: Record<"todo" | "in_progress" | "review" | "done", number>;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}
export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
}

// ── Tasks ───────────────────────────────────────────────────────────────────

export interface AssigneeUser {
  id: string;
  name: string;
  email: string;
}

export interface TaskAssignment {
  taskId: string;
  userId: string;
  createdAt: string;
  user: AssigneeUser;
}

/** Row returned by POST/PATCH /tasks (no relations). */
export interface TaskBase {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Row returned by GET /tasks (list) – includes assignments with user info. */
export interface Task extends TaskBase {
  assignments: TaskAssignment[];
}

/** GET /tasks/:id – includes the project but NOT assignments or comments. */
export interface TaskWithProject extends TaskBase {
  project: Project;
}

export interface TaskListParams {
  page?: number;
  limit?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  /** User id. */
  assignee?: string;
  /** ISO timestamps. */
  dueFrom?: string;
  dueTo?: string;
  projectId?: string;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  /** ISO timestamp. */
  dueDate?: string;
}

export interface UpdateTaskInput {
  projectId?: string;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
}

/** POST /tasks/:id/assign – `jobId` is only present if the email job was enqueued. */
export interface AssignmentResult {
  taskId: string;
  userId: string;
  createdAt: string;
  jobId?: string;
}

// ── Jobs ────────────────────────────────────────────────────────────────────

export type JobStatus = "pending" | "active" | "completed" | "failed";

/** GET /jobs/:id */
export interface JobInfo {
  jobId: string;
  status: JobStatus;
  type: string | null;
  createdAt: string | null;
  finishedAt: string | null;
  attemptsMade: number;
  failedReason: string | null;
}

// ── Organizations ───────────────────────────────────────────────────────────

/** GET /organizations/me */
export interface OrganizationSummary {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
}

/** Row returned by GET /organizations/me/members */
export interface OrganizationMember {
  userId: string;
  name: string;
  email: string;
  role: OrgRole;
  joinedAt: string;
}

/** GET /organizations/me/members – not paginated (no page/limit params or fields). */
export interface OrganizationMembersResponse {
  data: OrganizationMember[];
  total: number;
}

export interface InviteOrganizationMemberInput {
  email: string;
  role: OrgRole;
}

export interface OrganizationInvitation {
  id: string;
  email: string;
  role: OrgRole;
  createdAt: string;
  expiresAt?: string;
}

export interface OrganizationInvitationsResponse {
  data: OrganizationInvitation[];
  total: number;
}

export interface CreateOrganizationInput {
  name: string;
}

export interface CreatedOrganization {
  organization: { id: string; name: string; createdAt: string; updatedAt: string };
  membership: { organizationId: string; userId: string; role: OrgRole; createdAt: string };
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  link: string | null;
  organizationId: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationsResponse {
  data: Notification[];
  unreadCount: number;
  total: number;
}

// ── Comments ────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: AssigneeUser;
}

export interface CreateCommentInput {
  content: string;
}
export interface UpdateCommentInput {
  content: string;
}

// ── Errors ──────────────────────────────────────────────────────────────────

/** Standard error envelope produced by the backend error handler. */
export interface ApiErrorBody {
  error: string;
  code: string;
  details?: {
    issues?: Record<string, string[] | undefined>;
    [key: string]: unknown;
  };
}
