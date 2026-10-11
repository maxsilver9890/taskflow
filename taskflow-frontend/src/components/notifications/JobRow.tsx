"use client";

import Link from "next/link";

import { useJob } from "@/hooks/use-jobs";
import type { JobLogEntry } from "@/lib/job-log";
import { formatDateTime } from "@/lib/utils";
import { JobStatusPill } from "./JobStatusPill";
import { Skeleton } from "@/components/ui/Skeleton";
import { config } from "@/lib/config";

export function JobRow({ entry }: { entry: JobLogEntry }) {
  const { data, isLoading, isError } = useJob(entry.jobId);

  return (
    <div className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link href={`/tasks/${entry.taskId}`} className="truncate text-[13.5px] font-medium text-ink hover:text-brand">
          {entry.taskTitle}
        </Link>
        <p className="mt-0.5 truncate text-[12px] text-ink-3">
          Assigned to {entry.assigneeName} · {formatDateTime(entry.createdAt)}
        </p>
        {!config.workerDeployed && (
          <p className="mt-0.5 text-[11px] text-ink-3">
            The email worker only runs locally via Docker Compose, so this job stays pending on the public demo.
          </p>
        )}
      </div>
      <div className="shrink-0">
        {isLoading ? (
          <Skeleton className="h-6 w-20 rounded-full" />
        ) : isError ? (
          <span className="text-[12px] text-ink-3">Job not found</span>
        ) : data ? (
          <JobStatusPill status={data.status} />
        ) : null}
      </div>
    </div>
  );
}
