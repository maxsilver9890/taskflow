import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";

import type { JobStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const META: Record<JobStatus, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-s-todo-soft text-s-todo", icon: Clock },
  active: { label: "Active", className: "bg-s-progress-soft text-s-progress", icon: Loader2 },
  completed: { label: "Completed", className: "bg-s-done-soft text-s-done", icon: CheckCircle2 },
  failed: { label: "Failed", className: "bg-danger-soft text-danger", icon: XCircle },
};

export function JobStatusPill({ status }: { status: JobStatus }) {
  const m = META[status];
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium", m.className)}>
      <Icon className={cn("size-3", status === "active" && "animate-spin")} />
      {m.label}
    </span>
  );
}
