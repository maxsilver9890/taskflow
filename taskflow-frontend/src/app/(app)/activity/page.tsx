"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";
import { activityApi } from "@/lib/api/services";
import { qk } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/utils";

const PAGE_SIZE = 30;

function dateGroup(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export default function ActivityPage() {
  const { orgId, organizationName } = useAuth();
  const [page, setPage] = useState(1);
  const activity = useQuery({
    queryKey: qk.activity.comments(orgId, page, PAGE_SIZE),
    queryFn: () => activityApi.comments(page, PAGE_SIZE),
    enabled: !!orgId,
  });
  const entries = activity.data?.data ?? [];
  const total = activity.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const groups = entries.reduce<Record<string, typeof entries>>((result, entry) => {
    const label = dateGroup(entry.updatedAt);
    (result[label] ??= []).push(entry);
    return result;
  }, {});

  return (
    <div className="tf-activity-page">
      <header className="tf-activity-head">
        <div>
          <span className="tf-projects-eyebrow">Workspace / {organizationName ?? "Organization"}</span>
          <h1>ACTIVITY LOG</h1>
          <p>Real discussion updates from tasks in this workspace.</p>
        </div>
        <div className="tf-activity-controls">
          <div className="tf-activity-count is-unread"><strong>{total}</strong><span>Comment events</span></div>
          <div className="tf-activity-count"><strong>{entries.length}</strong><span>On this page</span></div>
        </div>
      </header>

      <div className="tf-activity-content space-y-6 p-4 md:p-6">
        <div className="tf-activity-filterbar">
          <div>
            <span className="tf-activity-filter-label">FEED</span>
            <strong>Task comments</strong>
          </div>
          <span>Newest first · {organizationName ?? "Current organization"}</span>
        </div>
        {activity.isError ? <ErrorState error={activity.error} onRetry={() => void activity.refetch()} /> : activity.isLoading ? (
          <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<MessageSquareText className="size-5" />}
            title="No comment activity yet"
            description="Comments added to tasks in this organization will appear here."
            action={<Link href="/tasks" className="tf-activity-empty-link">Browse tasks</Link>}
          />
        ) : (
          <>
            {Object.entries(groups).map(([group, groupedEntries]) => (
              <section key={group} className="tf-activity-group" aria-labelledby={`activity-${group.replaceAll(" ", "-")}`}>
                <h2 id={`activity-${group.replaceAll(" ", "-")}`} className="tf-activity-group-title"><span>{group}</span><i aria-hidden="true" /></h2>
                <div className="tf-comment-activity-list">
                  {groupedEntries.map((entry) => {
                    const wasEdited = !entry.deletedAt && new Date(entry.updatedAt).getTime() > new Date(entry.createdAt).getTime() + 1000;
                    return (
                      <article key={entry.id} className={`tf-comment-activity-card ${entry.deletedAt ? "is-deleted" : ""}`}>
                        <div className="tf-comment-activity-avatar"><Avatar name={entry.deletedAt ? entry.deletedByName ?? "A member" : entry.author.name} size="md" /></div>
                        <div className="tf-comment-activity-body">
                          <div className="tf-comment-activity-meta">
                            <strong>{entry.deletedAt ? entry.deletedByName ?? "A member" : entry.author.name}</strong>
                            <span>{entry.deletedAt ? "removed a comment" : wasEdited ? "updated a comment" : "commented"}</span>
                            <time dateTime={entry.updatedAt}>{formatDateTime(entry.updatedAt)}</time>
                          </div>
                          <p className="tf-comment-activity-task">
                            On <Link href={`/tasks/${entry.task.id}`}>{entry.task.title}</Link>
                            <span> / {entry.task.project.name}</span>
                          </p>
                          <blockquote>{entry.deletedAt ? `Comment deleted by ${entry.deletedByName ?? "a member"}.` : entry.content}</blockquote>
                          <div className="tf-comment-activity-footer">
                            <span className={`tf-activity-status status-${entry.task.status.toLowerCase().replaceAll("_", "-")}`}>{entry.task.status.replaceAll("_", " ")}</span>
                            <span>{entry.task.assignments.length ? `Assigned to ${entry.task.assignments.map(({ user }) => user.name).join(", ")}` : "Unassigned task"}</span>
                            <Link href={`/tasks/${entry.task.id}`} className="tf-comment-open-link">Open task <span aria-hidden="true">↗</span></Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
            <nav className="tf-activity-pagination" aria-label="Comment activity pages">
              <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
              <div>
                <Button variant="outline" size="sm" disabled={page <= 1 || activity.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="size-4" /> Previous</Button>
                <span>Page {page} of {pageCount}</span>
                <Button variant="outline" size="sm" disabled={page >= pageCount || activity.isFetching} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next <ChevronRight className="size-4" /></Button>
              </div>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
