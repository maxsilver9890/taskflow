"use client";

import { Check, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { errorMessage } from "@/lib/api/errors";
import type { AssigneeUser, Task } from "@/lib/api/types";
import { useOrgMembers } from "@/hooks/use-organization";
import { useAssignTask, useUnassignTask } from "@/hooks/use-tasks";

export function AssignDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
}) {
  const { members, isLoading } = useOrgMembers();
  const [query, setQuery] = useState("");
  const assign = useAssignTask();
  const unassign = useUnassignTask();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const assignedIds = new Set(task.assignments.map((a) => a.userId));
  const filtered = useMemo(
    () =>
      members.filter(
        (m) => m.name.toLowerCase().includes(query.toLowerCase()) || m.email.toLowerCase().includes(query.toLowerCase()),
      ),
    [members, query],
  );

  async function toggle(member: { userId: string; name: string; email: string }) {
    const assignee: AssigneeUser = { id: member.userId, name: member.name, email: member.email };
    setPendingId(member.userId);
    try {
      if (assignedIds.has(member.userId)) {
        await unassign.mutateAsync({ taskId: task.id, userId: member.userId });
        toast.success(`Unassigned ${member.name}`);
      } else {
        await assign.mutateAsync({ task, assignee });
        toast.success(`Assigned ${member.name}`, {
          description: "A notification job was queued for this assignment.",
        });
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Manage assignees"
      description={task.title}
      footer={
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      <Input placeholder="Search people…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      <p className="mt-2 text-[11.5px] text-ink-3">Anyone in your organization can be assigned to this task.</p>
      <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-4 animate-spin text-ink-3" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink-3">No matches.</p>
        ) : (
          filtered.map((member) => {
            const isAssigned = assignedIds.has(member.userId);
            const isPending = pendingId === member.userId;
            return (
              <button
                key={member.userId}
                onClick={() => toggle(member)}
                disabled={isPending}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2 disabled:opacity-60"
              >
                <Avatar name={member.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {member.name}
                    {member.isMe && <span className="ml-1 text-ink-3">(you)</span>}
                    {member.role === "ORG_ADMIN" && <span className="ml-1.5 text-[11px] font-medium text-brand">Admin</span>}
                  </span>
                  <span className="block truncate text-[11.5px] text-ink-3">{member.email}</span>
                </span>
                {isPending ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-ink-3" />
                ) : isAssigned ? (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink">
                    <Check className="size-3" />
                  </span>
                ) : (
                  <span className="size-5 shrink-0 rounded-full border border-line-strong" />
                )}
              </button>
            );
          })
        )}
      </div>
    </Dialog>
  );
}
