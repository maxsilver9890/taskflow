"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { PENDING_AUTH_NEXT_KEY, safeNextPath } from "@/lib/navigation";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { status, emailVerified } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // An authenticated-but-unverified user (e.g. straight after registering)
  // belongs on /verify-email, not /dashboard. /verify-email itself is
  // deliberately exempt from this effect entirely (both directions): that
  // page owns its own navigation (see its "emailVerified became true" effect),
  // because it needs to show a brief success state before redirecting away.
  // If this effect also raced to hide `children` the instant emailVerified
  // flipped true, the page would get unmounted before that success state —
  // or even the page itself — ever had a chance to render.
  useEffect(() => {
    if (status !== "authenticated" || pathname === "/verify-email") return;
    const queryNext = new URLSearchParams(window.location.search).get("next");
    const next = safeNextPath(queryNext) ?? safeNextPath(sessionStorage.getItem(PENDING_AUTH_NEXT_KEY));
    if (emailVerified) {
      sessionStorage.removeItem(PENDING_AUTH_NEXT_KEY);
      router.replace(next ?? "/dashboard");
    } else {
      router.replace(next ? `/verify-email?next=${encodeURIComponent(next)}` : "/verify-email");
    }
  }, [status, emailVerified, pathname, router]);

  const redirecting = status === "authenticated" && pathname !== "/verify-email";

  if (redirecting) {
    return (
      <div className="flex h-dvh items-center justify-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-ink-3" />
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0b2030] p-10 text-white lg:flex">
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 60% 70%, white 1px, transparent 1px)",
            backgroundSize: "34px 34px, 46px 46px",
          }}
        />
        <Link
          href="/"
          className="relative flex items-center gap-2 font-display text-[17px] font-bold transition-opacity hover:opacity-80"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-white/15 text-[14px]">T</span>
          TaskFlow
        </Link>
        <div className="relative max-w-md">
          <p className="font-display text-[28px] font-bold leading-tight">
            Organize projects, assign work, and keep every team in sync.
          </p>
          <p className="mt-3 text-[14px] text-white/70">
            Multi-tenant boards with role-based access, live task assignment, and background
            notifications — built on a real Node.js + Postgres + Redis backend.
          </p>
        </div>
        <p className="relative text-[12px] text-white/40">Demo workspace · not for production data</p>
      </div>

      <div className="relative flex items-center justify-center px-5 py-10">
        <Link
          href="/"
          className="absolute left-5 top-6 flex items-center gap-1.5 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink lg:left-8 lg:top-8"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Link>
        <div className="w-full max-w-[380px]">{children}</div>
      </div>
    </div>
  );
}
