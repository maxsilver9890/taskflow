"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthProvider";
import { organizationsApi } from "@/lib/api/services";
import { qk } from "@/lib/query-keys";
import { Button } from "@/components/ui/Button";

export default function InvitationPage() {
  const { token: rawToken } = useParams<{ token: string }>();
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const next = `/invitations/${encodeURIComponent(token)}`;
  const { status: authStatus, emailVerified, switchOrganization } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const invitation = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => organizationsApi.getInvitation(token),
    enabled: !!token,
  });

  const accept = useMutation({
    mutationFn: () => organizationsApi.acceptInvitation(token),
    onSuccess: async ({ organizationId }) => {
      await switchOrganization(organizationId);
      await queryClient.invalidateQueries({ queryKey: qk.org.memberships(organizationId) });
      await queryClient.invalidateQueries({ queryKey: qk.org.members(organizationId) });
      router.replace("/dashboard");
    },
  });
  const reject = useMutation({
    mutationFn: () => organizationsApi.rejectInvitation(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invitation", token] });
    },
  });

  if (authStatus === "loading" || invitation.isLoading) return <main className="mx-auto max-w-xl p-8">Loading invitation…</main>;
  if (invitation.isError || !invitation.data) return <main className="mx-auto max-w-xl p-8">This invitation could not be found.</main>;

  const invite = invitation.data;
  const isPending = invite.status === "PENDING";
  const loginHref = `/login?next=${encodeURIComponent(next)}`;
  const registerHref = `/register?next=${encodeURIComponent(next)}`;

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="font-display text-2xl font-bold text-ink">Organization invitation</h1>
      <p className="mt-3 text-ink-2">You’re invited to join <strong>{invite.organizationName}</strong> as {invite.role === "ORG_ADMIN" ? "an admin" : "a member"}.</p>
      <dl className="mt-5 space-y-2 text-sm text-ink-2">
        <div><dt className="inline font-medium">Invited email: </dt><dd className="inline">{invite.email}</dd></div>
        <div><dt className="inline font-medium">Expires: </dt><dd className="inline">{new Date(invite.expiresAt).toLocaleString()}</dd></div>
        <div><dt className="inline font-medium">Status: </dt><dd className="inline">{invite.status.toLowerCase()}</dd></div>
      </dl>

      {!isPending ? <p className="mt-6 text-sm text-ink-3">This invitation is no longer available.</p> : authStatus === "unauthenticated" ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={loginHref}><Button>Sign in to continue</Button></Link>
          <Link href={registerHref}><Button variant="secondary">Create account</Button></Link>
        </div>
      ) : !emailVerified ? (
        <div className="mt-6">
          <p className="mb-3 text-sm text-ink-3">Verify your email before processing this invitation.</p>
          <Link href={`/verify-email?next=${encodeURIComponent(next)}`}><Button>Verify email</Button></Link>
        </div>
      ) : (
        <div className="mt-6 flex gap-3">
          <Button loading={accept.isPending} onClick={() => accept.mutate()}>Accept invitation</Button>
          <Button variant="secondary" loading={reject.isPending} onClick={() => reject.mutate()}>Reject</Button>
        </div>
      )}
      {(accept.error || reject.error) && <p role="alert" className="mt-4 text-sm text-danger">{(accept.error || reject.error)?.message ?? "Unable to process invitation."}</p>}
      {reject.isSuccess && <p className="mt-4 text-sm text-ink-3">Invitation rejected.</p>}
    </main>
  );
}
