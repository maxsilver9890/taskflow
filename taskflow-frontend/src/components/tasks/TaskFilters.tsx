"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { Project, TaskPriority, TaskStatus } from "@/lib/api/types";
import type { OrgMemberRow } from "@/hooks/use-organization";

export interface TaskFilterState {
  projectId: string;
  status: TaskStatus | "";
  priority: TaskPriority | "";
  assignee: string;
  dueFrom: string;
  dueTo: string;
  overdue: boolean;
}

export const EMPTY_FILTERS: TaskFilterState = {
  projectId: "",
  status: "",
  priority: "",
  assignee: "",
  dueFrom: "",
  dueTo: "",
  overdue: false,
};

export function TaskFilters({
  filters,
  onChange,
  projects,
  members,
}: {
  filters: TaskFilterState;
  onChange: (next: TaskFilterState) => void;
  projects: Project[];
  members: OrgMemberRow[];
}) {
  function set<K extends keyof TaskFilterState>(key: K, value: TaskFilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  const hasFilters = Object.entries(filters).some(([k, v]) => (k === "overdue" ? v : v !== ""));

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-3">
      <div className="w-40">
        <Label htmlFor="f-project">Project</Label>
        <Select id="f-project" value={filters.projectId} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-36">
        <Label htmlFor="f-status">Status</Label>
        <Select id="f-status" value={filters.status} onChange={(e) => set("status", e.target.value as TaskStatus | "")}>
          <option value="">All statuses</option>
          <option value="TODO">To do</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="REVIEW">Review</option>
          <option value="DONE">Done</option>
        </Select>
      </div>
      <div className="w-32">
        <Label htmlFor="f-priority">Priority</Label>
        <Select id="f-priority" value={filters.priority} onChange={(e) => set("priority", e.target.value as TaskPriority | "")}>
          <option value="">All</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </Select>
      </div>
      <div className="w-40">
        <Label htmlFor="f-assignee">Assignee</Label>
        <Select id="f-assignee" value={filters.assignee} onChange={(e) => set("assignee", e.target.value)}>
          <option value="">Anyone</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
              {m.isMe ? " (you)" : ""}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-36">
        <Label htmlFor="f-due-from">Due from</Label>
        <Input id="f-due-from" type="date" value={filters.dueFrom} onChange={(e) => set("dueFrom", e.target.value)} />
      </div>
      <div className="w-36">
        <Label htmlFor="f-due-to">Due to</Label>
        <Input id="f-due-to" type="date" value={filters.dueTo} onChange={(e) => set("dueTo", e.target.value)} />
      </div>
      <label className="flex min-h-11 items-center gap-2 px-2 text-[13px] text-ink-2">
        <input
          type="checkbox"
          checked={filters.overdue}
          onChange={(e) => set("overdue", e.target.checked)}
          className="size-3.5 rounded border-line-strong accent-[var(--brand)]"
        />
        Overdue only
      </label>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
          <RotateCcw className="size-3.5" /> Reset
        </Button>
      )}
    </div>
  );
}
