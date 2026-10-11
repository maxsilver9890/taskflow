"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/errors";
import { projectsApi } from "@/lib/api/services";
import type { CreateProjectInput, Paginated, Project, UpdateProjectInput } from "@/lib/api/types";
import { qk } from "@/lib/query-keys";

export function useProjects(page: number, limit = 12) {
  return useQuery({
    queryKey: qk.projects.list(page, limit),
    queryFn: () => projectsApi.list(page, limit),
    placeholderData: keepPreviousData,
  });
}

/** Every project in the org (max 100 – the API page limit). Used for pickers and filters. */
export function useAllProjects() {
  return useQuery({
    queryKey: qk.projects.everything(),
    queryFn: () => projectsApi.list(1, 100),
    staleTime: 60_000,
    select: (res: Paginated<Project>) => res.data,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: qk.projects.detail(id),
    queryFn: () => projectsApi.get(id),
    retry: (count, err) => !(err instanceof ApiError && [403, 404].includes(err.status)) && count < 2,
  });
}

export function useProjectDashboard(id: string) {
  return useQuery({
    queryKey: qk.projects.dashboard(id),
    queryFn: () => projectsApi.dashboard(id),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.projects.all }),
  });
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => projectsApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.projects.all }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects.all });
      qc.invalidateQueries({ queryKey: qk.tasks.all });
    },
  });
}
