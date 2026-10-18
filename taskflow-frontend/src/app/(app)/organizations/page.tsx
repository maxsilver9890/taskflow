"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { FieldError, Input, Label } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useOrganizationMemberships } from "@/hooks/use-organization";
import { organizationsApi } from "@/lib/api/services";
import { useAuth } from "@/lib/auth/AuthProvider";
import { qk } from "@/lib/query-keys";

export default function OrganizationsPage() {
  const { orgId, switchOrganization } = useAuth();
  const memberships = useOrganizationMemberships();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const deleteOrganization = useMutation({
    mutationFn: organizationsApi.removeOrganization,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.org.memberships(orgId) });
      await queryClient.refetchQueries({ queryKey: qk.org.memberships(orgId), type: "active" });
      const next = (memberships.data?.data ?? []).find((item) => item.id !== orgId);
      if (next) await switchOrganization(next.id);
    },
  });
  const createOrganization = useMutation({
    mutationFn: () => organizationsApi.create({ name: name.trim() }),
    onSuccess: async (result) => {
      await switchOrganization(result.organization.id);
      setCreateOpen(false); setName(""); setError("");
      await queryClient.invalidateQueries({ queryKey: qk.org.memberships(orgId) });
      router.push("/dashboard");
    },
  });
  function submit() {
    if (!name.trim()) { setError("Organization name is required."); return; }
    setError(""); createOrganization.mutate();
  }
  return <div>
    <PageHeader title="Organizations" description="Create an organization or switch between the organizations you belong to." />
    <div className="space-y-4 p-4 md:p-6">
      <Card><CardHeader><div className="flex w-full items-center justify-between gap-3"><h2 className="text-[15px] font-semibold text-ink">Your organizations</h2><Button size="sm" onClick={() => setCreateOpen(true)}>+ Create organization</Button></div></CardHeader><CardBody>
        {memberships.isLoading ? <Skeleton className="h-12" /> : memberships.isError ? <p className="text-[13px] text-danger">Unable to load your organizations. Refresh the page to try again.</p> : (memberships.data?.data.length ?? 0) === 0 ? <div className="rounded-lg border border-dashed border-line p-6 text-center"><p className="font-medium text-ink">You don’t belong to an organization yet.</p><p className="mt-1 text-[13px] text-ink-3">Create one to start a workspace.</p><Button className="mt-4" onClick={() => setCreateOpen(true)}>Create organization</Button></div> : <div className="divide-y divide-line">{memberships.data!.data.map((membership) => <div key={membership.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate font-medium text-ink">{membership.name}</p><p className="text-[12px] text-ink-3">{membership.role === "ORG_ADMIN" ? "Org admin" : "Member"}{membership.id === orgId ? " · Active" : ""}</p></div><div className="flex gap-2">{membership.id !== orgId && <Button variant="outline" size="sm" onClick={() => void switchOrganization(membership.id)}>Switch</Button>}{membership.id === orgId && membership.role === "ORG_ADMIN" && <Button variant="danger" size="sm" loading={deleteOrganization.isPending} onClick={() => { if (window.confirm(`Delete ${membership.name} and all of its organization data? This cannot be undone.`)) deleteOrganization.mutate(); }}>Delete</Button>}</div></div>)}</div>}
      </CardBody></Card>
    </div>
    <Dialog open={createOpen} onOpenChange={setCreateOpen} title="Create organization" description="You will become an organization admin." footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button loading={createOrganization.isPending} onClick={submit}>Create</Button></>}><div><Label htmlFor="organization-name">Organization name</Label><Input id="organization-name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submit(); } }} /><FieldError>{error || (createOrganization.isError ? "Could not create organization. Please try again." : "")}</FieldError></div></Dialog>
  </div>;
}
