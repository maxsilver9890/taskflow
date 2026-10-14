"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { PENDING_AUTH_NEXT_KEY, safeNextPath } from "@/lib/navigation";
import AuthWorkspacePreview from "@/components/AuthWorkspacePreview";

import "./auth.css";

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
    <div className="auth-shell grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      <aside className="auth-story relative hidden min-h-dvh flex-col overflow-hidden p-8 text-ink lg:flex xl:p-12">
        <Link href="/" className="auth-brand relative z-10 flex w-fit items-center gap-2.5">
          <span className="auth-brand__mark">T</span>
          <span>taskflow<span className="auth-brand__period">.</span></span>
        </Link>

        <div className="auth-story__content relative z-10 my-auto grid w-full max-w-3xl gap-7 py-10 xl:gap-9">
          <div className="max-w-xl">
            <p className="auth-kicker">A clearer way to move work forward</p>
            <h2>Make every next step <em>clear.</em></h2>
            <p className="auth-story__lede">Bring projects, task ownership, and team updates into one workspace your whole team can follow.</p>
            <div className="auth-benefits" aria-label="TaskFlow workspace benefits">
              <span>Projects in context</span><span>Clear task ownership</span><span>Updates that stay connected</span>
            </div>
          </div>
          <AuthWorkspacePreview />
        </div>
        <div className="auth-story__footer"><span>Plan together. Move work forward.</span><span>TaskFlow workspace</span></div>
      </aside>
      <main className="auth-main relative flex items-center justify-center px-5 py-10">
        <div className="auth-mobile-brand lg:hidden">
          <Link href="/" className="auth-brand"><span className="auth-brand__mark">T</span><span>taskflow<span className="auth-brand__period">.</span></span></Link>
          <AuthWorkspacePreview compact />
        </div>
        <Link
          href="/"
          className="auth-home-link absolute left-5 top-6 flex items-center gap-1.5 text-[13px] font-medium transition-colors lg:left-8 lg:top-8"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Link>
        <div className="auth-form-wrap w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
