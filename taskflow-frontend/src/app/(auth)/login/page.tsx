"use client";

import { AlertCircle, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/AuthProvider";
import { DEMO_ACCOUNTS, config } from "@/lib/config";
import { PENDING_AUTH_NEXT_KEY, safeNextPath } from "@/lib/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { login, linkFirebaseAccount, resendFirebaseVerification } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showLinkRecovery, setShowLinkRecovery] = useState(false);
  const [taskflowPassword, setTaskflowPassword] = useState("");
  const [linking, setLinking] = useState(false);


  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setCanResend(false);
    setLoading(true);

    try {
      await login({ email: email.trim(), password });
      setShowLinkRecovery(false);
      const next = safeNextPath(params.get("next")) ?? safeNextPath(sessionStorage.getItem(PENDING_AUTH_NEXT_KEY));
      sessionStorage.removeItem(PENDING_AUTH_NEXT_KEY);
      router.replace(next ?? "/dashboard");
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      setCanResend(message.toLowerCase().includes("isn't verified"));
      setShowLinkRecovery(err instanceof ApiError && err.code === "EMAIL_IN_USE");
    } finally {
      setLoading(false);
    }
  }

  async function recoverLink(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLinking(true);
    try {
      await linkFirebaseAccount(taskflowPassword);
      const next = safeNextPath(params.get("next")) ?? safeNextPath(sessionStorage.getItem(PENDING_AUTH_NEXT_KEY));
      sessionStorage.removeItem(PENDING_AUTH_NEXT_KEY);
      router.replace(next ?? "/dashboard");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLinking(false);
    }
  }

  async function resendVerificationLink() {
    setError(null);
    setNotice(null);
    setResending(true);

    try {
      await resendFirebaseVerification({
        email: email.trim(),
        password,
      });

      setNotice(
        "Verification email requested. Check your inbox and spam folder.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResending(false);
    }
  }



  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(config.demoPassword);
    setError(null);
  }

  return (
    <div className="tf-slide-in">
      <h1 className="font-display text-[24px] font-bold text-ink">Welcome back</h1>
      <p className="mt-1 text-[13.5px] text-ink-3">Sign in to your TaskFlow workspace.</p>
      <p className="mt-2 text-[12.5px] text-ink-3">
        To link an existing TaskFlow account, sign in here with your Firebase password. If that email already has a TaskFlow account, you&apos;ll then be asked for its existing TaskFlow password.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="mb-1.5 text-[12.5px] font-medium text-brand hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        {notice && (
          <p className="text-[13px] text-emerald-400" role="status">
            {notice}
          </p>
        )}

        {canResend && (
          <button
            type="button"
            onClick={resendVerificationLink}
            disabled={resending || loading || !email.trim() || !password}
            className="w-full text-center text-[13px] font-medium text-brand hover:underline disabled:opacity-50"
          >
            {resending ? "Sending verification link..." : "Resend verification link"}
          </button>
        )}


        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Sign in
          <ArrowRight className="size-4" />
        </Button>
      </form>

      {showLinkRecovery && (
        <form onSubmit={recoverLink} className="mt-5 space-y-3 rounded-xl border border-line bg-surface-2 p-4">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Link your existing TaskFlow account</h2>
            <p className="mt-1 text-[12.5px] text-ink-3">
              This email already has a TaskFlow account. Enter that account&apos;s TaskFlow password to connect it to the verified Firebase account. Your existing workspace and data stay in place.
            </p>
          </div>
          <div>
            <Label htmlFor="taskflow-password">Existing TaskFlow password</Label>
            <Input
              id="taskflow-password"
              type="password"
              autoComplete="current-password"
              required
              value={taskflowPassword}
              onChange={(e) => setTaskflowPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" loading={linking} disabled={!taskflowPassword}>
            Verify and link accounts
          </Button>
        </form>
      )}

      {config.demoMode && (
        <div className="mt-6 rounded-xl border border-line bg-surface-2 p-4">
          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
            <Sparkles className="size-3.5 text-brand" />
            Demo accounts
          </p>
          <p className="mt-1 text-[12px] text-ink-3">One-click sign-in using the backend&apos;s seed data.</p>
          <div className="mt-3 grid gap-1.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => fillDemo(acc.email)}
                className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-left text-[12.5px] transition-colors hover:border-brand/40 hover:bg-brand-soft/40"
              >
                <span>
                  <span className="font-medium text-ink">{acc.name}</span>
                  <span className="text-ink-3"> · {acc.org}</span>
                </span>
                <span className="text-ink-3">{acc.role}</span>
              </button>
            ))}
          </div>
          {!config.demoPassword && (
            <p className="mt-2 text-[11.5px] text-ink-3">
              Set <code className="rounded bg-surface px-1">NEXT_PUBLIC_DEMO_PASSWORD</code> to autofill the password too.
            </p>
          )}
        </div>
      )}

      <p className="mt-6 text-center text-[13px] text-ink-3">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
