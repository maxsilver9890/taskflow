"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { authApi } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/errors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.forgotPassword({ email: email.trim() });
      // Always show the same success state, whether or not the email is
      // registered — the API deliberately never reveals that either.
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="tf-slide-in text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <CheckCircle2 className="size-6" />
        </div>
        <h1 className="mt-4 font-display text-[22px] font-bold text-ink">Check your email</h1>
        <p className="mt-2 text-[13.5px] text-ink-3">
          If an account exists for <span className="font-medium text-ink">{email.trim()}</span>, we&apos;ve sent a link to
          reset your password. It expires in 1 hour.
        </p>
        <Link href="/login" className="mt-6 inline-block text-[13px] font-medium text-brand hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="tf-slide-in">
      <h1 className="font-display text-[24px] font-bold text-ink">Forgot your password?</h1>
      <p className="mt-1 text-[13.5px] text-ink-3">
        Enter the email on your account and we&apos;ll send you a link to reset it.
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
            autoFocus
          />
        </div>

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Send reset link
          <ArrowRight className="size-4" />
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-ink-3">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
