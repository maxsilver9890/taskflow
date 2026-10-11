"use client";

import { Bell } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api/services";
import { qk } from "@/lib/query-keys";
import { formatDateTime } from "@/lib/utils";
import type { Notification } from "@/lib/api/types";

export default function NotificationsPage() {
  const notifications = useQuery({ queryKey: qk.notifications.all(), queryFn: notificationsApi.list });
  const entries = notifications.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Updates and activity from your TaskFlow organizations."
      />

      <div className="space-y-4 p-4 md:p-6">
        {notifications.isLoading ? <Skeleton className="h-48" /> : entries.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-5" />}
            title="No notifications yet"
            description="You’re all caught up."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {entries.map((entry: Notification) => (
              <div key={entry.id} className="border-b border-line px-4 py-3 last:border-0">
                <p className="font-medium text-ink">{entry.title}</p>
                <p className="text-[13px] text-ink-2">{entry.message}</p>
                <p className="mt-1 text-[11px] text-ink-3">{formatDateTime(entry.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
