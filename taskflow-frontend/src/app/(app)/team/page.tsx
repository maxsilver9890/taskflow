"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
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
  const invitationRows = invitations.data?.data ?? [];
  const pendingInvitations = invitationRows.filter((invitation) =>
    !invitation.acceptedAt &&
    !invitation.cancelledAt &&
    !invitation.rejectedAt
  );
  const rejectedInvitations = invitationRows.filter((invitation) =>
    Boolean(invitation.rejectedAt) && !invitation.cancelledAt && !invitation.acceptedAt
  );
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
    <div className="tf-team-page">
      <header className="tf-team-head">
        <div>
          <span className="tf-projects-eyebrow">People / {org.data?.name ?? "Organization"}</span>
          <h1>TEAM MEMBERS</h1>
          <p>{org.data ? pluralize(org.data.memberCount, "member") : "Your organization roster"}</p>
        </div>
        {isAdmin && <Button size="md" onClick={() => setInviteOpen(true)}><UserPlus className="size-4" /> Invite member</Button>}
      </header>
      <div className="tf-team-content p-4 md:p-6">
        <div className="tf-team-section-head"><h2>IN THIS ORGANIZATION</h2><span>{String(total).padStart(2, "0")} MEMBERS</span></div>
        {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : isLoading ? (
          <div className="tf-team-grid">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="tf-team-card"><div className="flex items-center gap-3"><Skeleton className="size-11 rounded-full" /><Skeleton className="h-5 w-36" /></div><Skeleton className="mt-5 h-8 w-28" /></div>)}
          </div>
        ) : members.length === 0 ? <EmptyState icon={<Users className="size-5" />} title="No members yet" /> : (
          <div className="tf-team-grid">
            {members.map((member) => (
              <article key={member.userId} className={`tf-team-card ${member.isMe ? "is-you" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={member.name} size="lg" />
                    <div className="min-w-0">
                      <h3 className="truncate">{member.name}{member.isMe && <span className="tf-team-you-label">YOU</span>}</h3>
                      <p className="truncate text-[12px] text-ink-3">{member.email}</p>
                    </div>
                  </div>
                  {isAdmin && !member.isMe && <Button aria-label={`Remove ${member.name}`} variant="ghost" size="icon" onClick={() => removeMember(member.userId, member.name)} loading={removeMutation.isPending}><Trash2 className="size-4 text-danger" /></Button>}
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">Workspace role</span>
                    {isAdmin && !member.isMe ? (
                      <select aria-label={`Role for ${member.name}`} value={member.role} onChange={(event) => changeRole(member.userId, event.target.value as OrgRole, member.role)} disabled={roleMutation.isPending} className="tf-team-role-select min-h-9 border border-line bg-surface px-2 text-[12px] font-bold uppercase text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand">
                        <option value="ORG_ADMIN">Org admin</option><option value="MEMBER">Member</option>
                      </select>
                    ) : <Badge className="w-fit bg-brand text-black">{member.role === "ORG_ADMIN" ? "Org admin" : "Member"}</Badge>}
                  </div>
                  <p className="text-right text-[11px] text-ink-3"><span className="block font-bold uppercase tracking-wide">Joined</span>{formatDueDate(member.joinedAt)}</p>
                </div>
              </article>
            ))}
          </div>
        )}
        {total > members.length && <p className="mt-2 text-[12px] text-ink-3">Showing {members.length} of {total} members.</p>}
      </div>
      {isAdmin && pendingInvitations.length > 0 ? (
        <div className="tf-team-invitations px-4 pb-4 md:px-6">
          <div className="tf-team-invitation-panel">
            <div className="tf-team-invitation-head">
              <h2>Pending invitations</h2><span>{String(pendingInvitations.length).padStart(2, "0")}</span>
            </div>
            <div className="divide-y divide-line">
              {pendingInvitations.map((invitation) => (
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
      {isAdmin && rejectedInvitations.length > 0 ? (
        <div className="tf-team-invitations px-4 pb-4 md:px-6">
          <div className="tf-team-invitation-panel">
            <div className="tf-team-invitation-head">
              <h2>Rejected invitations</h2><span>{String(rejectedInvitations.length).padStart(2, "0")}</span>
            </div>
            <div className="divide-y divide-line">
              {rejectedInvitations.map((invitation) => (
                <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px]">
                  <div>
                    <p className="font-medium text-ink">{invitation.email}</p>
                    <p className="text-[11.5px] text-ink-3">
                      {invitation.role === "ORG_ADMIN" ? "Org admin" : "Member"} · Rejected
                    </p>
                  </div>
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
