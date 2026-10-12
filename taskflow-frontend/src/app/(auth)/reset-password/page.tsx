"use client";

import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label } from "@/components/ui/Input";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { authApi } from "@/lib/api/services";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (password !== confirm) {
      setError("Passwords don’t match.");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({ token, newPassword: password });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      }
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="tf-slide-in text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
          <AlertCircle className="size-6" />
        </div>
        <h1 className="mt-4 font-display text-[22px] font-bold text-ink">Invalid reset link</h1>
        <p className="mt-2 text-[13.5px] text-ink-3">
          This link is missing its reset token. Request a new one below.
        </p>
        <Link href="/forgot-password" className="mt-6 inline-block text-[13px] font-medium text-brand hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="tf-slide-in text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <CheckCircle2 className="size-6" />
        </div>
        <h1 className="mt-4 font-display text-[22px] font-bold text-ink">Password reset</h1>
        <p className="mt-2 text-[13.5px] text-ink-3">
          Your password has been changed. All of your existing sessions have been signed out — log in again with your
          new password.
        </p>
        <Button className="mt-6 w-full" size="lg" onClick={() => router.replace("/login")}>
          Go to log in
          <ArrowRight className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="tf-slide-in">
      <h1 className="font-display text-[24px] font-bold text-ink">Choose a new password</h1>
      <p className="mt-1 text-[13.5px] text-ink-3">This resets your TaskFlow account password.</p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <div>
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoFocus
          />
          <FieldError>{fieldErrors.newPassword?.[0]}</FieldError>
        </div>
        <div>
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Reset password
          <ArrowRight className="size-4" />
        </Button>
      </form>
    </div>
  );
}
