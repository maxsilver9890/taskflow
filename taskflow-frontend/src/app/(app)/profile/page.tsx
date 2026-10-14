"use client";

import { AlertCircle, KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { FieldError, Input, Label } from "@/components/ui/Input";
import { ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";
import { useChangePassword, useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useOrganizationMemberships, useOrgMembers } from "@/hooks/use-organization";
import { organizationsApi } from "@/lib/api/services";
import { useAuth } from "@/lib/auth/AuthProvider";
import { qk } from "@/lib/query-keys";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { readSession, writeSession } from "@/lib/auth/session";

export default function ProfilePage() {
  const profile = useProfile();
  const update = useUpdateProfile();
  const changePassword = useChangePassword();
  const memberships = useOrganizationMemberships();
  const { members, query: membersQuery } = useOrgMembers();
  const { orgId, isAdmin, switchOrganization } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  const [organizationMessage, setOrganizationMessage] = useState<string | null>(null);
  const createOrganization = useMutation({
    mutationFn: (name: string) => organizationsApi.create({ name }),
    onSuccess: async (result) => {
      await switchOrganization(result.organization.id);
      await queryClient.invalidateQueries({ queryKey: qk.org.memberships(orgId) });
      setCreateOpen(false);
      setOrganizationMessage("Organization created.");
    },
  });
  const leaveOrganization = useMutation({
    mutationFn: () => organizationsApi.leave(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.org.memberships(orgId) });
      await queryClient.invalidateQueries({ queryKey: qk.org.members(orgId) });
      const next = (memberships.data?.data ?? []).find((item) => item.id !== orgId);
      if (next) await switchOrganization(next.id);
      else window.location.assign("/login");
    },
  });
  const deleteOrganization = useMutation({
    mutationFn: () => organizationsApi.removeOrganization(),
    onSuccess: async () => {
      const next = (memberships.data?.data ?? []).find((item) => item.id !== orgId);
      if (next) await switchOrganization(next.id);
      else window.location.assign("/login");
    },
  });
  const transferAdmin = useMutation({
    mutationFn: (userId: string) => organizationsApi.transferAdmin(userId),
    onSuccess: async () => {
      setTransferOpen(false);
      setTransferTargetId(null);
      await leaveOrganization.mutateAsync();
    },
  });
  const [name, setName] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  if (profile.isLoading) {
    return <><PageHeader title="Profile" description="Manage your account and organization." /><div className="space-y-4 p-4 md:p-6"><Skeleton className="h-48" /><Skeleton className="h-40" /></div></>;
  }
  if (profile.isError || !profile.data) return <><PageHeader title="Profile" /><div className="p-4 md:p-6"><ErrorState error={profile.error} onRetry={() => profile.refetch()} /></div></>;

  const data = profile.data;
  const currentAdmins = members.filter((member) => member.role === "ORG_ADMIN");
  const eligibleTransferTargets = members.filter((member) => member.userId !== data.id);
  const isLastAdminWithOtherMembers =
    isAdmin && !membersQuery.isLoading && currentAdmins.length === 1 && eligibleTransferTargets.length > 0;
  async function saveName(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      const updated = await update.mutateAsync({ name: (name ?? data.name).trim() });
      const session = readSession();
      if (session) writeSession({ ...session, user: { ...session.user, name: updated.name }, organizationName: updated.organization.name });
      setMessage("Profile updated.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  return (
    <div>
      <PageHeader title="Profile" description="Manage your account and organization." />
      <div className="space-y-5 p-4 md:p-6">
        <Card id="organizations">
          <CardHeader><h2 className="text-[15px] font-semibold text-ink">Personal information</h2></CardHeader>
          <CardBody>
            <form onSubmit={saveName} className="max-w-xl space-y-4">
              <div><Label htmlFor="profile-name">Name</Label><Input id="profile-name" value={name ?? data.name} onChange={(e) => setName(e.target.value)} required maxLength={255} /></div>
              <div><Label htmlFor="profile-email">Email</Label><Input id="profile-email" value={data.email} readOnly className="bg-surface-2" /></div>
              {message && <p className="text-[13px] text-brand">{message}</p>}
              <Button type="submit" loading={update.isPending}>Save changes</Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-[15px] font-semibold text-ink">Organizations</h2></CardHeader>
          <CardBody>
            {memberships.isLoading ? (
              <Skeleton className="h-10" />
            ) : memberships.isError ? (
              <p className="text-[13px] text-danger">Unable to load your organization memberships.</p>
            ) : (
              <div className="divide-y divide-line">
                {(memberships.data?.data ?? []).map((membership) => (
                  <div key={membership.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{membership.name}</p>
                      <p className="text-[12px] text-ink-3">{membership.role === "ORG_ADMIN" ? "Org admin" : "Member"}</p>
                    </div>
                    {membership.id === data.organization.id && <span className="rounded-full bg-brand-soft px-2 py-1 text-[11px] font-medium text-brand">Active</span>}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>+ Create organization</Button>
              {organizationMessage && <span className="text-[13px] text-brand">{organizationMessage}</span>}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-[15px] font-semibold text-danger">Danger zone</h2></CardHeader>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-medium text-ink">Leave {data.organization.name}</p><p className="text-[13px] text-ink-3">You will lose access to this organization.</p></div>
            <div className="flex flex-wrap gap-2">
              {isLastAdminWithOtherMembers && (
                <Button variant="outline" size="sm" disabled={transferAdmin.isPending} onClick={() => {
                  setTransferTargetId(null);
                  setTransferOpen(true);
                }}>Transfer admin & leave</Button>
              )}
              <Button variant="outline" size="sm" disabled={leaveOrganization.isPending || isLastAdminWithOtherMembers} onClick={() => {
                if (window.confirm(`Leave ${data.organization.name}?`)) leaveOrganization.mutate();
              }}>Leave organization</Button>
              {isAdmin && <Button variant="danger" size="sm" loading={deleteOrganization.isPending} onClick={() => {
                if (window.confirm(`Delete ${data.organization.name} and all of its organization data? This cannot be undone.`)) deleteOrganization.mutate();
              }}>Delete organization</Button>}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-[15px] font-semibold text-ink">Security</h2></CardHeader>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-medium text-ink">Password</p><p className="text-[13px] text-ink-3">Change your password while signed in.</p></div>
            <div className="flex flex-wrap items-center gap-3">
              {passwordMessage && <p className="text-[13px] text-brand">{passwordMessage}</p>}
              <Button variant="outline" onClick={() => { setPasswordMessage(null); setPasswordOpen(true); }}><KeyRound className="size-4" /> Change password</Button>
            </div>
          </CardBody>
        </Card>
      </div>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} mutation={changePassword} onSuccess={() => setPasswordMessage("Password changed successfully.")} />
      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} mutation={createOrganization} />
      <Dialog
        open={transferOpen}
        onOpenChange={(open) => {
          setTransferOpen(open);
          if (!open) setTransferTargetId(null);
        }}
        title="Transfer admin"
        description={`You are the only admin of ${data.organization.name}. Choose a member to become an admin before you leave.`}
        footer={<>
          <Button variant="secondary" onClick={() => setTransferOpen(false)}>Cancel</Button>
          <Button
            loading={transferAdmin.isPending || leaveOrganization.isPending}
            disabled={!transferTargetId}
            onClick={() => {
              if (transferTargetId) transferAdmin.mutate(transferTargetId);
            }}
          >
            Transfer admin &amp; leave
          </Button>
        </>}
      >
        <div className="space-y-2">
          {eligibleTransferTargets.map((member) => (
            <label key={member.userId} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-[13px] text-ink transition-colors hover:bg-surface-2">
              <input
                type="radio"
                name="transfer-admin-target"
                value={member.userId}
                checked={transferTargetId === member.userId}
                onChange={() => setTransferTargetId(member.userId)}
                className="accent-brand"
              />
              <span>{member.name}</span>
              <span className="ml-auto text-[11px] text-ink-3">{member.role === "ORG_ADMIN" ? "Org admin" : "Member"}</span>
            </label>
          ))}
        </div>
      </Dialog>
    </div>
  );
}

function CreateOrganizationDialog({ open, onOpenChange, mutation }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutation: { isPending: boolean; mutate: (name: string) => void };
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setError("Organization name is required."); return; }
    setError("");
    mutation.mutate(name.trim());
  }
  return <Dialog open={open} onOpenChange={onOpenChange} title="Create organization" description="You will become an organization admin." footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" form="create-organization" loading={mutation.isPending}>Create</Button></>}>
    <form id="create-organization" onSubmit={submit} className="space-y-4">
      <div><Label htmlFor="organization-name">Organization name</Label><Input id="organization-name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus /><FieldError>{error}</FieldError></div>
    </form>
  </Dialog>;
}

function ChangePasswordDialog({ open, onOpenChange, mutation, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; mutation: ReturnType<typeof useChangePassword>; onSuccess: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null); setFieldErrors({});
    if (newPassword !== confirm) { setError("Passwords don’t match."); return; }
    try {
      await mutation.mutateAsync({ currentPassword, newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirm(""); onSuccess(); onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      setError(errorMessage(err));
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange} title="Change password" description="Use a password you do not reuse elsewhere." footer={<Button type="submit" form="change-password" loading={mutation.isPending}>Update password</Button>}>
    <form id="change-password" onSubmit={submit} className="space-y-4" noValidate>
      <div><Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /><FieldError>{fieldErrors.currentPassword?.[0]}</FieldError></div>
      <div><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /><FieldError>{fieldErrors.newPassword?.[0]}</FieldError></div>
      <div><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div>
      {error && <div className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div>}
    </form>
  </Dialog>;
}
