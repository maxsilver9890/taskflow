"use client";

import { AlertCircle, ArrowRight, CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, sendEmailVerification, type User } from "firebase/auth";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { errorMessage } from "@/lib/api/errors";
import { firebaseAuth } from "@/lib/firebase";
import { PENDING_AUTH_NEXT_KEY, safeNextPath } from "@/lib/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  exchangeFirebaseUser,
  pendingRegistrationFromStorage,
  verificationActionSettings,
} from "@/lib/auth/AuthProvider";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { status: authStatus, user: sessionUser, emailVerified: sessionVerified, verifyEmail, resendVerification } = useAuth();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [otp, setOtp] = useState("");

  function returnPath() {
    const queryNext = new URLSearchParams(window.location.search).get("next");
    const next = safeNextPath(queryNext) ?? safeNextPath(sessionStorage.getItem(PENDING_AUTH_NEXT_KEY));
    sessionStorage.removeItem(PENDING_AUTH_NEXT_KEY);
    return next ?? "/dashboard";
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setChecking(true);
    try {
      await verifyEmail(otp.trim());
      setVerified(true);
      router.replace(returnPath());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!active) return;
      setFirebaseUser(user);
      setEmail(user?.email ?? sessionUser?.email ?? pendingRegistrationFromStorage()?.email ?? null);

      if (!user) {
        setChecking(false);
        return;
      }

      try {
        await user.reload();
        if (!active) return;

        setEmail(user.email);
        if (user.emailVerified) {
          await exchangeFirebaseUser(user, pendingRegistrationFromStorage());
          if (!active) return;
          setVerified(true);
          router.replace(returnPath());
          return;
        }
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setChecking(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router, sessionUser?.email]);

  async function resendVerificationLink() {
    setError(null);
    setNotice(null);

    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
      setError("Log in first to request a new verification link.");
      return;
    }

    setSending(true);
    try {
      await sendEmailVerification(currentUser, verificationActionSettings());
      setNotice("A new verification link has been sent. Check your inbox and spam folder.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function checkVerificationStatus() {
    setError(null);
    setChecking(true);
    try {
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) {
        setError("No Firebase session was found in this browser. Log in after verifying your email.");
        return;
      }

      await currentUser.reload();
      if (!currentUser.emailVerified) {
        setError("Your email is not verified yet. Open the verification link from your inbox, then check again.");
        return;
      }

      await exchangeFirebaseUser(currentUser, pendingRegistrationFromStorage());
      setVerified(true);
      router.replace(returnPath());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  }

  if (checking || verified) {
    return (
      <div className="tf-slide-in text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <CheckCircle2 className="size-6" />
        </div>
        <h1 className="mt-4 font-display text-[22px] font-bold text-ink">
          {verified ? "Email verified" : "Checking verification"}
        </h1>
        <p className="mt-2 text-[13.5px] text-ink-3">
          {verified ? "Taking you into TaskFlow…" : "Checking your Firebase account…"}
        </p>
      </div>
    );
  }

  return (
    <div className="tf-slide-in">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Mail className="size-6" />
      </div>
      <h1 className="mt-4 text-center font-display text-[22px] font-bold text-ink">
        Verify your email
      </h1>
      <p className="mt-2 text-center text-[13.5px] text-ink-3">
        {email
          ? <>We sent a verification link to <span className="font-medium text-ink">{email}</span>. Open that link, then return here.</>
          : "Open the Firebase verification link from your email. If you verified on another device, log in to TaskFlow afterward."}
      </p>

      {error && (
        <div className="mt-5 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      {notice && (
        <p className="mt-4 text-center text-[12.5px] text-brand">{notice}</p>
      )}

      <div className="mt-6 space-y-3">
        {authStatus === "authenticated" && !sessionVerified && (
          <form onSubmit={verifyOtp} className="space-y-3">
            <label htmlFor="verification-otp" className="block text-sm font-medium text-ink">Email verification code</label>
            <input id="verification-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink" placeholder="6-digit code" />
            <Button type="submit" className="w-full" size="lg" loading={checking} disabled={otp.length !== 6}>Verify code</Button>
            <Button type="button" variant="secondary" className="w-full" loading={sending} onClick={async () => {
              setSending(true);
              try { await resendVerification(); setNotice("A new verification code has been sent."); }
              catch (err) { setError(errorMessage(err)); }
              finally { setSending(false); }
            }}>Resend verification code</Button>
          </form>
        )}
        {!(authStatus === "authenticated" && !sessionVerified) && (
          <Button type="button" className="w-full" size="lg" onClick={() => void checkVerificationStatus()}>
            I&apos;ve verified my email <ArrowRight className="size-4" />
          </Button>
        )}

        {firebaseUser && !firebaseUser.emailVerified && (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            size="lg"
            loading={sending}
            onClick={() => void resendVerificationLink()}
          >
            Resend verification link
          </Button>
        )}
      </div>

      <p className="mt-6 text-center text-[13px] text-ink-3">
        Already verified?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
