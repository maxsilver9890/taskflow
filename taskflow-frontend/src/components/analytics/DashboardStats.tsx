"use client";

import type { ProjectDashboard } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const ROWS: { key: keyof ProjectDashboard["counts"]; label: string; color: string; bg: string }[] = [
  { key: "todo", label: "To do", color: "text-s-todo", bg: "bg-s-todo" },
  { key: "in_progress", label: "In progress", color: "text-s-progress", bg: "bg-s-progress" },
  { key: "review", label: "Review", color: "text-s-review", bg: "bg-s-review" },
  { key: "done", label: "Done", color: "text-s-done", bg: "bg-s-done" },
];

export function DashboardStats({ dashboard }: { dashboard: ProjectDashboard }) {
  const total = Object.values(dashboard.counts).reduce((a, b) => a + b, 0);
  const donePct = total > 0 ? Math.round((dashboard.counts.done / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-[11.5px] font-medium text-ink-3">Total tasks</p>
        <p className="mt-1 font-display text-[24px] font-bold text-ink">{total}</p>
        <p className="mt-0.5 text-[11.5px] text-ink-3">{donePct}% complete</p>
      </div>
      {ROWS.map((row) => (
        <div key={row.key} className="rounded-xl border border-line bg-surface p-4">
          <p className={cn("flex items-center gap-1.5 text-[11.5px] font-medium", row.color)}>
            <span className={cn("size-1.5 rounded-full", row.bg)} />
            {row.label}
          </p>
          <p className="mt-1 font-display text-[24px] font-bold text-ink">{dashboard.counts[row.key]}</p>
        </div>
      ))}
    </div>
  );
}
