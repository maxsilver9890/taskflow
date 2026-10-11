"use client";

import { useQuery } from "@tanstack/react-query";

import { jobsApi } from "@/lib/api/services";
import { ApiError } from "@/lib/api/errors";
import type { JobInfo } from "@/lib/api/types";
import { qk } from "@/lib/query-keys";

const isSettled = (job: JobInfo | undefined) => job?.status === "completed" || job?.status === "failed";

/** Polls GET /jobs/:id until the job completes or fails. */
export function useJob(jobId: string, opts: { poll?: boolean } = {}) {
  const poll = opts.poll ?? true;
  return useQuery({
    queryKey: qk.jobs.detail(jobId),
    queryFn: () => jobsApi.get(jobId),
    refetchInterval: (query) => (poll && !isSettled(query.state.data) ? 3000 : false),
    retry: (count, err) => !(err instanceof ApiError && [403, 404].includes(err.status)) && count < 2,
  });
}
