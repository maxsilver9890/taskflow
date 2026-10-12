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
      <div className="relative hidden min-h-dvh flex-col overflow-hidden bg-[#081b29] p-10 text-white lg:flex xl:p-12">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.24) 1px, transparent 0)", backgroundSize: "28px 28px" }} />
        <div className="pointer-events-none absolute -left-40 top-1/4 size-[28rem] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 right-[-5rem] size-[30rem] rounded-full bg-orange-400/10 blur-3xl" />
        <Link href="/" className="relative z-10 flex w-fit items-center gap-2.5 font-display text-[17px] font-bold transition-opacity hover:opacity-80">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-[14px] text-brand-ink shadow-lg shadow-orange-950/20">T</span>
          TaskFlow
        </Link>

        <div className="relative z-10 my-auto grid w-full max-w-3xl gap-8 py-10 xl:gap-10">
          <div className="max-w-xl">
            <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-300">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgb(52_211_153/0.8)]" />
              One clear place to move work forward
            </p>
            <h2 className="max-w-lg font-display text-3xl font-bold leading-[1.12] tracking-tight text-white xl:text-[2.6rem]">
              Give good work a <span className="text-orange-300">clear path.</span>
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300">
              Plan projects, make ownership visible, and keep every update connected to the work it moves.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-medium text-slate-200">
              {["Projects that stay organized", "Clear task ownership", "Updates in one place"].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5">
                  <span aria-hidden="true" className="text-emerald-300">✓</span>{item}
                </span>
              ))}
            </div>
          </div>

          <div className="w-full max-w-[600px] rounded-2xl border border-white/10 bg-[#102737]/90 p-4 shadow-2xl shadow-black/25 backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1 sm:p-5">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">Workspace preview</p>
                <p className="mt-1 truncate text-sm font-semibold text-white">Product launch</p>
              </div>
              <div className="flex -space-x-2" aria-label="Three teammates">
                {["AL", "MK", "JR"].map((initials) => (
                  <span key={initials} className="flex size-8 items-center justify-center rounded-full border-2 border-[#102737] bg-orange-500 text-[9px] font-bold text-white">
                    {initials}
                  </span>
                ))}
                <span className="flex size-8 items-center justify-center rounded-full border-2 border-[#102737] bg-white/10 text-[9px] font-semibold text-slate-300">+2</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-medium text-slate-300"><span className="size-2 rounded-full border border-slate-400" />Up next</p>
                <div className="mt-3 space-y-2"><div className="h-2 w-4/5 rounded bg-white/20" /><div className="h-2 w-3/5 rounded bg-white/10" /><div className="mt-3 flex items-center gap-1.5 text-[9px] text-slate-400"><span className="size-4 rounded-full bg-sky-500/70" />Brief outline</div></div>
              </div>
              <div className="rounded-xl border border-orange-300/20 bg-orange-300/[0.055] p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-medium text-orange-200"><span className="size-2 rounded-full bg-orange-300" />In progress</p>
                <div className="mt-3 space-y-2"><div className="h-2 w-4/5 rounded bg-orange-100/35" /><div className="h-2 w-2/3 rounded bg-white/10" /><div className="mt-3 flex items-center gap-1.5 text-[9px] text-slate-300"><span className="size-4 rounded-full bg-violet-500/80" />Review launch page</div></div>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-medium text-slate-300"><span className="text-emerald-300">✓</span>Done</p>
                <div className="mt-3 space-y-2"><div className="h-2 w-3/4 rounded bg-white/20" /><div className="h-2 w-1/2 rounded bg-white/10" /><div className="mt-3 flex items-center gap-1.5 text-[9px] text-slate-400"><span className="size-4 rounded-full bg-emerald-600/80" />Set project goals</div></div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/10 px-3 py-2.5">
              <p className="flex items-center gap-2 text-[10px] text-slate-300"><span className="flex size-5 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-300">✓</span>Project momentum</p>
              <div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10"><div className="h-full w-2/3 rounded-full bg-emerald-400" /></div><span className="text-[10px] font-semibold text-emerald-200">On track</span><span className="text-slate-400">↗</span></div>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-slate-400">
          <span>Built for teams that ship together</span>
          <span className="text-orange-300">Make progress visible</span>
        </div>
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
