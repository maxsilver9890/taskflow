"use client";

import { AlertCircle, KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { FieldError, Input, Label } from "@/components/ui/Input";
import { ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";
import { useChangePassword, useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { readSession, writeSession } from "@/lib/auth/session";

export default function ProfilePage() {
  const profile = useProfile();
  const update = useUpdateProfile();
  const changePassword = useChangePassword();
  const [name, setName] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  if (profile.isLoading) return <><PageHeader title="Profile" description="Manage your account details and security." /><div className="space-y-4 p-4 md:p-6"><Skeleton className="h-48" /><Skeleton className="h-40" /></div></>;
  if (profile.isError || !profile.data) return <><PageHeader title="Profile" /><div className="p-4 md:p-6"><ErrorState error={profile.error} onRetry={() => profile.refetch()} /></div></>;
  const data = profile.data;
  async function saveName(event: FormEvent) {
    event.preventDefault(); setMessage(null);
    try {
      const updated = await update.mutateAsync({ name: (name ?? data.name).trim() });
      const session = readSession();
      if (session) writeSession({ ...session, user: { ...session.user, name: updated.name } });
      setMessage("Profile updated.");
    } catch (error) { setMessage(errorMessage(error)); }
  }
  return <div>
    <PageHeader title="Profile" description="Manage your account details and security." />
    <div className="tf-profile-grid p-4 md:p-6">
      <Card className="tf-profile-card tf-profile-personal"><CardHeader><h2 className="text-[15px] font-semibold text-ink">Personal information</h2></CardHeader><CardBody>
        <form onSubmit={saveName} className="max-w-xl space-y-4"><div><Label htmlFor="profile-name">Name</Label><Input id="profile-name" value={name ?? data.name} onChange={(e) => setName(e.target.value)} required maxLength={255} /></div><div><Label htmlFor="profile-email">Email</Label><Input id="profile-email" value={data.email} readOnly className="bg-surface-2" /></div>{message && <p className="text-[13px] text-brand">{message}</p>}<Button type="submit" loading={update.isPending}>Save changes</Button></form>
      </CardBody></Card>
      <Card className="tf-profile-card tf-profile-security"><CardHeader><h2 className="text-[15px] font-semibold text-ink">Security</h2></CardHeader><CardBody className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium text-ink">Password</p><p className="text-[13px] text-ink-3">Change your password while signed in.</p></div><div className="flex flex-wrap items-center gap-3">{passwordMessage && <p className="text-[13px] text-brand">{passwordMessage}</p>}<Button variant="outline" onClick={() => { setPasswordMessage(null); setPasswordOpen(true); }}><KeyRound className="size-4" /> Change password</Button></div></CardBody></Card>
    </div>
    <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} mutation={changePassword} onSuccess={() => setPasswordMessage("Password changed successfully.")} />
  </div>;
}

function ChangePasswordDialog({ open, onOpenChange, mutation, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; mutation: ReturnType<typeof useChangePassword>; onSuccess: () => void }) {
  const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState<string | null>(null); const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  async function submit(event: FormEvent) { event.preventDefault(); setError(null); setFieldErrors({}); if (newPassword !== confirm) { setError("Passwords don’t match."); return; } try { await mutation.mutateAsync({ currentPassword, newPassword }); setCurrentPassword(""); setNewPassword(""); setConfirm(""); onSuccess(); onOpenChange(false); } catch (err) { if (err instanceof ApiError) setFieldErrors(err.fieldErrors); setError(errorMessage(err)); } }
  return <Dialog open={open} onOpenChange={onOpenChange} title="Change password" description="Use a password you do not reuse elsewhere." footer={<Button type="submit" form="change-password" loading={mutation.isPending}>Update password</Button>}><form id="change-password" onSubmit={submit} className="space-y-4" noValidate><div><Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /><FieldError>{fieldErrors.currentPassword?.[0]}</FieldError></div><div><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /><FieldError>{fieldErrors.newPassword?.[0]}</FieldError></div><div><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div>{error && <div className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div>}</form></Dialog>;
}
