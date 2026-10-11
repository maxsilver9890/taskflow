"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FieldError, Input, Label } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useOrganization, useOrgMembers } from "@/hooks/use-organization";
import { organizationsApi } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/errors";
import type { OrgRole } from "@/lib/api/types";
import { qk } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDueDate, pluralize } from "@/lib/utils";

function InviteMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("MEMBER");
  const [fieldError, setFieldError] = useState("");
  const queryClient = useQueryClient();
  const { orgId } = useAuth();
  const invite = useMutation({
    mutationFn: () => organizationsApi.invite({ email: email.trim(), role }),
    onSuccess: () => {
      toast.success("Invitation sent");
      void queryClient.invalidateQueries({ queryKey: qk.org.members(orgId) });
      void queryClient.invalidateQueries({ queryKey: qk.org.detail(orgId) });
      setEmail("");
      setRole("MEMBER");
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setFieldError("");
    invite.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Invite a team member" description="They’ll receive an invitation to join this organization."
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)} disabled={invite.isPending}>Cancel</Button><Button onClick={submit} loading={invite.isPending}>Send invitation</Button></>}>
      <form id="invite-member-form" onSubmit={submit} className="space-y-4">
        <div><Label htmlFor="invite-email">Email address</Label><Input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" autoFocus disabled={invite.isPending} /><FieldError>{fieldError}</FieldError></div>
        <div><Label htmlFor="invite-role">Role</Label><select id="invite-role" value={role} onChange={(event) => setRole(event.target.value as OrgRole)} disabled={invite.isPending} className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"><option value="MEMBER">Member</option><option value="ORG_ADMIN">Org admin</option></select></div>
      </form>
    </Dialog>
  );
}

export default function TeamPage() {
  const org = useOrganization();
  const { isAdmin, orgId } = useAuth();
  const { members, total, isLoading, query } = useOrgMembers();
  const [inviteOpen, setInviteOpen] = useState(false);
  const queryClient = useQueryClient();
  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) => organizationsApi.updateMemberRole(userId, role),
    onSuccess: () => { toast.success("Member role updated"); void queryClient.invalidateQueries({ queryKey: qk.org.members(orgId) }); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const removeMutation = useMutation({
    mutationFn: (userId: string) => organizationsApi.removeMember(userId),
    onSuccess: () => { toast.success("Member removed"); void queryClient.invalidateQueries({ queryKey: qk.org.members(orgId) }); void queryClient.invalidateQueries({ queryKey: qk.org.detail(orgId) }); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const invitations = useQuery({
    queryKey: qk.org.invitations(orgId),
    queryFn: () => organizationsApi.invitations(),
    enabled: isAdmin && !!orgId,
  });
  const cancelInvitation = useMutation({
    mutationFn: (id: string) => organizationsApi.cancelInvitation(id),
    onSuccess: () => {
      toast.success("Invitation cancelled");
      void queryClient.invalidateQueries({ queryKey: qk.org.invitations(orgId) });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function changeRole(userId: string, nextRole: OrgRole, currentRole: OrgRole) {
    if (nextRole === currentRole || roleMutation.isPending) return;
    if (!window.confirm(`Change this member’s role to ${nextRole === "ORG_ADMIN" ? "org admin" : "member"}?`)) return;
    roleMutation.mutate({ userId, role: nextRole });
  }

  function removeMember(userId: string, name: string) {
    if (removeMutation.isPending || !window.confirm(`Remove ${name} from this organization?`)) return;
    removeMutation.mutate(userId);
  }

  return (
    <div>
      <PageHeader title="Team" description={org.data ? `${org.data.name} · ${pluralize(org.data.memberCount, "member")}` : "Everyone in your organization."}
        actions={isAdmin ? <Button size="sm" onClick={() => setInviteOpen(true)}><UserPlus className="size-4" />Invite member</Button> : undefined} />
      <div className="p-4 md:p-6">
        {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : isLoading ? <div className="overflow-hidden rounded-xl border border-line bg-surface">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0"><Skeleton className="size-8 rounded-full" /><Skeleton className="h-4 w-40" /></div>)}</div> : members.length === 0 ? <EmptyState icon={<Users className="size-5" />} title="No members yet" /> : <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full text-left text-[13px]"><thead><tr className="border-b border-line text-[11.5px] uppercase tracking-wide text-ink-3"><th className="px-4 py-2.5 font-medium">Name</th><th className="px-4 py-2.5 font-medium">Role</th><th className="hidden px-4 py-2.5 font-medium sm:table-cell">Joined</th>{isAdmin && <th className="w-12 px-2 py-2.5" />}</tr></thead>
            <tbody>{members.map((member) => <tr key={member.userId} className="border-b border-line last:border-0"><td className="px-4 py-3"><div className="flex items-center gap-2.5"><Avatar name={member.name} size="sm" /><span className="min-w-0"><span className="block truncate font-medium text-ink">{member.name}{member.isMe && <span className="ml-1 font-normal text-ink-3">(you)</span>}</span><span className="block truncate text-[11.5px] text-ink-3">{member.email}</span></span></div></td>
              <td className="px-4 py-3">{isAdmin && !member.isMe ? <select aria-label={`Role for ${member.name}`} value={member.role} onChange={(event) => changeRole(member.userId, event.target.value as OrgRole, member.role)} disabled={roleMutation.isPending} className="rounded-md border border-transparent bg-transparent px-1 py-1 text-[12px] text-ink outline-none hover:border-line focus:border-brand">{<><option value="ORG_ADMIN">Org admin</option><option value="MEMBER">Member</option></>}</select> : member.role === "ORG_ADMIN" ? <span className="text-[12px] font-medium text-brand">Org admin</span> : <span className="text-[12px] text-ink-3">Member</span>}</td>
              <td className="hidden px-4 py-3 text-ink-2 sm:table-cell">{formatDueDate(member.joinedAt)}</td>{isAdmin && <td className="px-2 py-3 text-right">{!member.isMe && <Button aria-label={`Remove ${member.name}`} variant="ghost" size="icon" onClick={() => removeMember(member.userId, member.name)} loading={removeMutation.isPending}><Trash2 className="size-4 text-danger" /></Button>}</td>}</tr>)}</tbody>
          </table></div>}
        {total > members.length && <p className="mt-2 text-[12px] text-ink-3">Showing {members.length} of {total} members.</p>}
      </div>
      {isAdmin && invitations.data?.data.length ? (
        <div className="px-4 pb-4 md:px-6">
          <div className="rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-[13px] font-semibold text-ink">Pending invitations</h2>
            </div>
            <div className="divide-y divide-line">
              {invitations.data.data.map((invitation) => (
                <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px]">
                  <div>
                    <p className="font-medium text-ink">{invitation.email}</p>
                    <p className="text-[11.5px] text-ink-3">
                      {invitation.role === "ORG_ADMIN" ? "Org admin" : "Member"} · expires {invitation.expiresAt ? formatDueDate(invitation.expiresAt) : "soon"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={cancelInvitation.isPending}
                    onClick={() => cancelInvitation.mutate(invitation.id)}
                  >
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {isAdmin && <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />}
    </div>
  );
}
