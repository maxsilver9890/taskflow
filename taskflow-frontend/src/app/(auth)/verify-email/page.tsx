"use client";

import { AlertCircle, ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { forceRefreshTokens } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { authApi } from "@/lib/api/services";
import { writeSession } from "@/lib/auth/session";
import { useAuth } from "@/lib/auth/AuthProvider";

const PENDING_EMAIL_KEY = "taskflow.pendingRegistrationEmail";

export default function VerifyEmailPage() {
  const { status, user, emailVerified, verifyEmail, resendVerification, logout } = useAuth();
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const justVerified = useRef(false);
  const success = status === "authenticated" && emailVerified;

  useEffect(() => {
    setPendingEmail(sessionStorage.getItem(PENDING_EMAIL_KEY));
    setPendingLoaded(true);
  }, []);

  useEffect(() => {
    if (!pendingLoaded) return;
    if (status === "unauthenticated" && !pendingEmail) {
      router.replace("/login");
      return;
    }
    if (success) {
      if (!justVerified.current) {
        router.replace("/dashboard");
        return;
      }
      const timer = window.setTimeout(() => router.replace("/dashboard"), 700);
      return () => window.clearTimeout(timer);
    }
  }, [pendingLoaded, pendingEmail, status, success, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function recoverFromAlreadyVerified() {
    try {
      await forceRefreshTokens();
    } catch {
      // The existing session can refresh normally on its next request.
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (otp.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setVerifying(true);
    try {
      justVerified.current = true;
      if (pendingEmail) {
        const result = await authApi.verifyRegistration({ email: pendingEmail, otp });
        writeSession({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
          organizationName: result.organization.name,
        });
        sessionStorage.removeItem(PENDING_EMAIL_KEY);
      } else {
        await verifyEmail(otp);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_ALREADY_VERIFIED") {
        await recoverFromAlreadyVerified();
        return;
      }
      if (err instanceof ApiError && err.code === "OTP_LOCKED") setLocked(true);
      setError(errorMessage(err));
      setOtp("");
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResendNotice(null);
    setResending(true);
    try {
      const result = pendingEmail
        ? await authApi.resendRegistration(pendingEmail)
        : await resendVerification();
      setLocked(false);
      setOtp("");
      setCooldown(result.cooldownSeconds);
      setResendNotice("If your registration is pending, a new code has been requested.");
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_ALREADY_VERIFIED") {
        await recoverFromAlreadyVerified();
        return;
      }
      if (err instanceof ApiError && err.code === "OTP_RESEND_COOLDOWN") {
        const retryAfter = err.details.retryAfterSeconds;
        if (typeof retryAfter === "number") setCooldown(retryAfter);
      }
      setError(errorMessage(err));
    } finally {
      setResending(false);
    }
  }

  async function handleWrongAccount() {
    await logout();
    router.replace("/login");
  }

  if (!pendingLoaded) return null;

  if (success) {
    return (
      <div className="tf-slide-in text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <CheckCircle2 className="size-6" />
        </div>
        <h1 className="mt-4 font-display text-[22px] font-bold text-ink">Email verified</h1>
        <p className="mt-2 text-[13.5px] text-ink-3">Taking you into TaskFlow…</p>
      </div>
    );
  }

  return (
    <div className="tf-slide-in">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Mail className="size-6" />
      </div>
      <h1 className="mt-4 text-center font-display text-[22px] font-bold text-ink">Verify your email</h1>
      <p className="mt-2 text-center text-[13.5px] text-ink-3">
        Enter the 6-digit code sent to <span className="font-medium text-ink">{pendingEmail ?? user?.email ?? "your email address"}</span>. It expires in 10 minutes.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <div>
          <Label htmlFor="otp">Verification code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            disabled={locked}
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="text-center text-[22px] font-semibold tracking-[0.5em]"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" size="lg" loading={verifying} disabled={locked || otp.length !== 6}>
          Verify <ArrowRight className="size-4" />
        </Button>
      </form>

      <div className="mt-5 text-center text-[13px]">
        {resendNotice && !error && <p className="mb-2 text-[12.5px] text-brand">{resendNotice}</p>}
        {cooldown > 0 ? (
          <p className="text-ink-3">Resend code in {cooldown}s</p>
        ) : (
          <button type="button" onClick={() => void handleResend()} disabled={resending} className="font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-50">
            {resending ? "Sending…" : "Resend code"}
          </button>
        )}
      </div>

      {!pendingEmail && (
        <p className="mt-6 text-center text-[13px] text-ink-3">
          Wrong account?{" "}
          <button type="button" onClick={() => void handleWrongAccount()} className="font-medium text-brand hover:underline">Sign out</button>
        </p>
      )}
    </div>
  );
}
