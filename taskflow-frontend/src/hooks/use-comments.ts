"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { commentsApi } from "@/lib/api/services";
import { qk } from "@/lib/query-keys";

const LIMIT = 50;

export function useComments(taskId: string) {
  return useQuery({
    queryKey: qk.comments.ofTask(taskId),
    queryFn: () => commentsApi.list(taskId, 1, LIMIT),
    enabled: !!taskId,
  });
}

export function useCreateComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => commentsApi.create(taskId, { content }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.comments.ofTask(taskId) }),
  });
}

export function useUpdateComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      commentsApi.update(taskId, commentId, { content }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.comments.ofTask(taskId) }),
  });
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => commentsApi.remove(taskId, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.comments.ofTask(taskId) }),
  });
}
