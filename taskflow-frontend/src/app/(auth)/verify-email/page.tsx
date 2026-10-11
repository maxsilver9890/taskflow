"use client";

import { AlertCircle, ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { forceRefreshTokens } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function VerifyEmailPage() {
  const { status, user, emailVerified, verifyEmail, resendVerification, logout } = useAuth();
  const router = useRouter();

  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const justVerified = useRef(false);

  // Derived, not stored: `success` is fully determined by emailVerified, so
  // there is no separate piece of local state to get out of sync with it.
  const success = status === "authenticated" && emailVerified;

  // This page owns 100% of its own post-verification navigation (AuthLayout
  // deliberately exempts /verify-email from its own redirect effect — see
  // the comment there). This single effect's only job is the navigation
  // side-effect itself; it covers every way `success` can become true while
  // mounted here — a normal OTP submit, the EMAIL_ALREADY_VERIFIED recovery
  // path (forceRefreshTokens), or simply arriving already verified (stale
  // bookmark, verified in another tab) — all with the same brief,
  // reassuring dwell on the success state before redirecting, which is
  // harmless even when nothing actually just happened in this tab.
  // Unauthenticated visitors have nothing to verify and are sent to sign in.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (success) {
      if (!justVerified.current) {
        router.replace("/dashboard");
        return;
      }
      const timer = setTimeout(() => router.replace("/dashboard"), 700);
      return () => clearTimeout(timer);
    }
  }, [status, success, router]);

  // Local countdown ticker, seeded from the server's cooldownSeconds (see
  // below) rather than a hardcoded guess — stays correct even if the account
  // already had a cooldown in flight (e.g. the OTP queued at registration).
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  /**
   * The account turned out to already be verified (e.g. confirmed in another
   * tab) — our local token's emailVerified claim is just stale. Force a real
   * refresh rather than a hardcoded redirect: the effect above reacts to
   * `emailVerified` becoming true and owns the success state + navigation
   * from there, however it was triggered.
   */
  async function recoverFromAlreadyVerified() {
    try {
      await forceRefreshTokens();
    } catch {
      // Worst case the stale claim lingers until the access token's natural
      // 15-minute expiry forces a refresh anyway; not worth surfacing an
      // error for what is, from the user's point of view, good news.
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (otp.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setVerifying(true);
    try {
      // Writes a fresh emailVerified: true token pair — the effect above
      // picks up that change and handles the success state + redirect.
      justVerified.current = true;
      await verifyEmail(otp);
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_ALREADY_VERIFIED") {
        await recoverFromAlreadyVerified();
        return;
      }
      if (err instanceof ApiError && err.code === "OTP_LOCKED") {
        setLocked(true);
      }
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
      const { cooldownSeconds } = await resendVerification();
      setLocked(false);
      setOtp("");
      setCooldown(cooldownSeconds);
      setResendNotice("A new code is on its way.");
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_ALREADY_VERIFIED") {
        await recoverFromAlreadyVerified();
        return;
      }
      // OTP_RESEND_COOLDOWN: sync the countdown to the server's authoritative
      // remaining time instead of just showing an error and leaving the
      // button clickable again immediately.
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
        We sent a 6-digit code to{" "}
        <span className="font-medium text-ink">{user?.email ?? "your email address"}</span>. It expires in 10
        minutes.
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
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
          Verify
          <ArrowRight className="size-4" />
        </Button>
      </form>

      <div className="mt-5 text-center text-[13px]">
        {resendNotice && !error && <p className="mb-2 text-[12.5px] text-brand">{resendNotice}</p>}
        {cooldown > 0 ? (
          <p className="text-ink-3">Resend code in {cooldown}s</p>
        ) : (
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resending}
            className="font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
        )}
      </div>

      <p className="mt-6 text-center text-[13px] text-ink-3">
        Wrong account?{" "}
        <button type="button" onClick={() => void handleWrongAccount()} className="font-medium text-brand hover:underline">
          Sign out
        </button>
      </p>
    </div>
  );
}
