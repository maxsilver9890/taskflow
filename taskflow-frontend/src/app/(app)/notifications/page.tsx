"use client";

import { Bell, Check, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";
import { notificationsApi } from "@/lib/api/services";
import { qk } from "@/lib/query-keys";
import { formatDateTime } from "@/lib/utils";
import type { Notification } from "@/lib/api/types";

function notificationGroup(createdAt: string) {
  const date = new Date(createdAt);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (left: Date, right: Date) => left.toDateString() === right.toDateString();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const notifications = useQuery({ queryKey: qk.notifications.all(), queryFn: notificationsApi.list });
  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.notifications.all() }),
  });
  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.notifications.all() }),
  });
  const entries = notifications.data?.data ?? [];
  const groups = entries.reduce<Record<string, Notification[]>>((result, entry) => {
    const label = notificationGroup(entry.createdAt);
    (result[label] ??= []).push(entry);
    return result;
  }, {});
  const unreadCount = notifications.data?.unreadCount ?? 0;

  return (
    <div className="tf-activity-page">
      <header className="tf-activity-head">
        <div>
          <span className="tf-projects-eyebrow">Workspace / Notifications</span>
          <h1>ACTIVITY LOG</h1>
          <p>Notifications saved for your TaskFlow account, grouped by date.</p>
        </div>
        <div className="tf-activity-controls">
          <div className="tf-activity-count"><strong>{entries.length}</strong><span>Notifications</span></div>
          <div className="tf-activity-count is-unread"><strong>{unreadCount}</strong><span>Unread</span></div>
          <Button variant="outline" size="sm" onClick={() => void notifications.refetch()} loading={notifications.isFetching}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
          {unreadCount > 0 && <Button size="sm" onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>Mark all read</Button>}
        </div>
      </header>

      <div className="tf-activity-content space-y-6 p-4 md:p-6">
        {notifications.isError ? <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} /> : notifications.isLoading ? <Skeleton className="h-48" /> : entries.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-5" />}
            title="No notifications yet"
            description="You’re all caught up."
          />
        ) : (
          Object.entries(groups).map(([group, groupedEntries]) => (
            <section key={group} className="tf-activity-group" aria-labelledby={`notifications-${group.replaceAll(" ", "-")}`}>
              <h2 id={`notifications-${group.replaceAll(" ", "-")}`} className="tf-activity-group-title">
                <span>{group}</span><i aria-hidden="true" />
              </h2>
              <div className="tf-activity-timeline">
                <span className="tf-activity-date-mark"><Bell className="size-4" /></span>
                <div className="tf-activity-events">
                {groupedEntries.map((entry) => {
                  const content = (
                    <span className="flex min-w-0 items-start gap-3">
                      <span className={`mt-1 flex size-9 shrink-0 items-center justify-center border-2 border-black ${entry.readAt ? "bg-surface-2" : "bg-brand"}`}>
                        <Bell className="size-4 text-black" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-ink">{entry.title}</span>
                          {!entry.readAt && <span className="border-2 border-black bg-brand px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black">New</span>}
                        </span>
                        <span className="mt-1 block text-[13px] leading-relaxed text-ink-2">{entry.message}</span>
                        <span className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-ink-3">{formatDateTime(entry.createdAt)}</span>
                      </span>
                    </span>
                  );
                  return (
                    <article key={entry.id} className={`tf-activity-item ${entry.readAt ? "is-read" : "is-new"}`}>
                      {entry.link ? <Link href={entry.link} onClick={() => { if (!entry.readAt) markRead.mutate(entry.id); }} className="min-w-0 flex-1 hover:underline focus-visible:outline-2 focus-visible:outline-focus">{content}</Link> : <div className="min-w-0 flex-1">{content}</div>}
                      {!entry.readAt && <Button variant="ghost" size="icon" aria-label={`Mark ${entry.title} as read`} onClick={() => markRead.mutate(entry.id)} loading={markRead.isPending}><Check className="size-4" /></Button>}
                    </article>
                  );
                })}
                </div>
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
