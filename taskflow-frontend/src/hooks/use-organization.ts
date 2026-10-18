"use client";

import { useQuery } from "@tanstack/react-query";

import { organizationsApi } from "@/lib/api/services";
import { useAuth } from "@/lib/auth/AuthProvider";
import { qk } from "@/lib/query-keys";

export function useOrganization() {
  const { status, orgId } = useAuth();
  return useQuery({
    queryKey: qk.org.detail(orgId),
    queryFn: () => organizationsApi.get(),
    staleTime: 60_000,
    enabled: status === "authenticated" && !!orgId,
  });
}

export function useOrganizationMemberships() {
  const { status, orgId } = useAuth();
  return useQuery({
    queryKey: qk.org.memberships(orgId),
    queryFn: () => organizationsApi.memberships(),
    staleTime: 60_000,
    enabled: status === "authenticated",
  });
}

export interface OrgMemberRow {
  userId: string;
  name: string;
  email: string;
  role: "ORG_ADMIN" | "MEMBER";
  joinedAt: string;
  isMe: boolean;
}

/**
 * The real organization roster, from GET /organizations/me/members — every
 * member of the org, whether or not they've ever been assigned a task.
 * Replaces the earlier task-assignee-derived approximation.
 */
export function useOrgMembers() {
  const { user, status, orgId } = useAuth();
  const query = useQuery({
    queryKey: qk.org.members(orgId),
    queryFn: () => organizationsApi.members(),
    staleTime: 60_000,
    enabled: status === "authenticated" && !!orgId,
  });

  const members: OrgMemberRow[] = (query.data?.data ?? [])
    .map((m) => ({ ...m, isMe: m.userId === user?.id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { members, total: query.data?.total ?? 0, isLoading: query.isLoading, query };
}
