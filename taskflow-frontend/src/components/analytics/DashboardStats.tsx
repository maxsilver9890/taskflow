"use client";

import type { ProjectDashboard } from "@/lib/api/types";
const ROWS: { key: keyof ProjectDashboard["counts"]; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

export function DashboardStats({ dashboard }: { dashboard: ProjectDashboard }) {
  const total = Object.values(dashboard.counts).reduce((a, b) => a + b, 0);
  const donePct = total > 0 ? Math.round((dashboard.counts.done / total) * 100) : 0;

  return (
    <div className="tf-project-metrics">
      <div className="tf-project-metric tf-project-metric-total">
        <p>Project completion</p>
        <div className="tf-project-metric-main"><strong>{donePct}<small>%</small></strong><span>{total} total tasks</span></div>
        <div className="tf-project-progress-track" role="progressbar" aria-label="Project completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={donePct}>
          <span style={{ width: `${donePct}%` }} />
        </div>
      </div>
      {ROWS.map((row) => (
        <div key={row.key} className="tf-project-metric">
          <p className="tf-project-metric-label">
            <span className={`tf-status-mark is-${row.key.replace("in_progress", "progress")}`} />
            {row.label}
          </p>
          <strong>{dashboard.counts[row.key]}</strong>
          <span>{total ? `${Math.round((dashboard.counts[row.key] / total) * 100)}% of tasks` : "No tasks yet"}</span>
        </div>
      ))}
    </div>
  );
}
