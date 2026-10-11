"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { usersApi } from "@/lib/api/services";
import type { ChangePasswordInput, UpdateProfileInput } from "@/lib/api/types";
import { qk } from "@/lib/query-keys";

export function useProfile() {
  return useQuery({
    queryKey: qk.user.me(),
    queryFn: usersApi.me,
    staleTime: 60_000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => usersApi.updateMe(input),
    onSuccess: (profile) => queryClient.setQueryData(qk.user.me(), profile),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => usersApi.changePassword(input),
  });
}
