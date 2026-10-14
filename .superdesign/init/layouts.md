# Shared Layouts — TaskFlow


## src/app/layout.tsx

Root document shell, fonts, global CSS, and providers.

```tsx
import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

import { Providers } from "@/lib/Providers";

export const metadata: Metadata = {
  title: { default: "TaskFlow — Reliable task execution for real teams", template: "%s · TaskFlow" },
  description:
    "TaskFlow is a multi-tenant project management platform: organize projects and tasks, assign work across your team, and trust background notifications to actually get delivered — with automatic retries and nothing silently lost.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5efe4" },
    { media: "(prefers-color-scheme: dark)", color: "#0b2030" },
  ],
};

// Sets the theme before first paint to avoid a flash of the wrong palette.
const themeScript = `
(function(){try{
  var t = localStorage.getItem('taskflow.theme');
  if(!t){ t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  document.documentElement.setAttribute('data-theme', t);
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-pop"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## src/app/(auth)/layout.tsx

Split-screen authentication shell with public form content.

```tsx
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
```

## src/app/(marketing)/layout.tsx

Marketing-site shell and global navigation/footer wrapper.

```tsx
import type { ReactNode } from "react";
import "./marketing.css";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

## src/app/(app)/layout.tsx

Authenticated route gate and application shell wrapper.

```tsx
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

## src/components/layout/AppShell.tsx

Authenticated navigation, organization switcher, notifications, and user menu.

```tsx
"use client";

import { Bell, Building2, Check, ChevronsUpDown, LayoutDashboard, ListChecks, Loader2, LogOut, Moon, Settings, Sun, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Avatar } from "@/components/ui/Avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/DropdownMenu";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useOrganization, useOrganizationMemberships } from "@/hooks/use-organization";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { formatDateTime } from "@/lib/utils";
import { notificationsApi } from "@/lib/api/services";
import { qk } from "@/lib/query-keys";
import type { Notification } from "@/lib/api/types";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: ListChecks },
  { href: "/tasks", label: "All tasks", icon: ListChecks },
  { href: "/team", label: "Team", icon: Users },
  { href: "/profile#organizations", label: "Organizations", icon: Building2 },
] as const;

function initialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("taskflow.theme");
  const value = stored === "dark" || stored === "light" ? stored : document.documentElement.getAttribute("data-theme");
  return value === "dark" ? "dark" : "light";
}

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem("taskflow.theme", next);
  };
  return { theme, toggle };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { status, user, orgId, organizationName, isAdmin, emailVerified, logout } = useAuth();
  const organization = useOrganization();
  const memberships = useOrganizationMemberships();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (status === "authenticated" && !emailVerified) {
      // Every route under (app) is a real resource endpoint gated server-side
      // by requireVerifiedEmail — send an unverified user to finish that
      // first rather than rendering a shell whose data fetches will 403.
      router.replace("/verify-email");
    }
  }, [status, emailVerified, router, pathname]);

  if (status !== "authenticated" || !user || !emailVerified) {
    return (
      <div className="flex h-dvh items-center justify-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-ink-3" />
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-pop"
      >
        Skip to content
      </a>

      {/* Top bar (mobile) + side rail (desktop) */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur-sm md:hidden">
        <Logo />
        <OrganizationSwitcher memberships={memberships.data?.data ?? []} currentId={orgId} />
        <nav className="ml-auto flex items-center gap-1">
          <NotificationBell />
          <UserMenu name={user.name} email={user.email} org={organizationName ?? organization.data?.name ?? null} isAdmin={isAdmin} theme={theme} onToggleTheme={toggle} onLogout={handleLogout} onProfile={() => router.push("/profile")} />
        </nav>
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 md:flex">
          <div className="mb-6 px-2">
            <Logo />
          </div>
          <nav className="flex flex-1 flex-col gap-0.5">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors",
                    active ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-line pt-3">
            <UserMenu
              name={user.name}
              email={user.email}
              org={organizationName ?? organization.data?.name ?? null}
              isAdmin={isAdmin}
              theme={theme}
              onToggleTheme={toggle}
              onLogout={handleLogout}
              onProfile={() => router.push("/profile")}
              full
            />
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1 pb-16 md:pb-0">
          <div className="hidden h-14 items-center justify-end gap-2 border-b border-line bg-surface/90 px-6 backdrop-blur-sm md:flex">
            <NotificationBell />
            <OrganizationSwitcher memberships={memberships.data?.data ?? []} currentId={orgId} />
          </div>
          {children}
        </main>
      </div>

      {/* Bottom tab bar (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur-sm md:hidden">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium",
                active ? "text-brand" : "text-ink-3",
              )}
            >
              <item.icon className="size-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function OrganizationSwitcher({
  memberships,
  currentId,
}: {
  memberships: { id: string; name: string; role: "ORG_ADMIN" | "MEMBER" }[];
  currentId: string | null;
}) {
  const { switchOrganization } = useAuth();
  const [switching, setSwitching] = useState(false);
  const current = memberships.find((item) => item.id === currentId);
  async function select(id: string) {
    if (id === currentId || switching) return;
    setSwitching(true);
    try {
      await switchOrganization(id);
    } finally {
      setSwitching(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex min-w-[150px] items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-left hover:bg-surface-2" disabled={switching}>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] uppercase tracking-wide text-ink-3">Organization</span>
            <span className="block truncate text-[13px] font-medium text-ink">{current?.name ?? "Select organization"}</span>
          {current && <span className="block text-[10px] text-ink-3">{current.role === "ORG_ADMIN" ? "Org admin" : "Member"}</span>}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-ink-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {memberships.map((membership) => (
          <DropdownMenuItem key={membership.id} onSelect={() => void select(membership.id)} disabled={membership.id === currentId}>
            <span className="min-w-0 flex-1 truncate">{membership.name}</span>
            <span className="text-[10px] text-ink-3">{membership.role === "ORG_ADMIN" ? "Admin" : "Member"}</span>
            {membership.id === currentId && <Check className="size-3.5 text-brand" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationBell() {
  const queryClient = useQueryClient();
  const notifications = useQuery({ queryKey: qk.notifications.all(), queryFn: notificationsApi.list });
  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.notifications.all() }),
  });
  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.notifications.all() }),
  });
  const entries = notifications.data?.data ?? [];
  const unreadCount = notifications.data?.unreadCount ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Bell className="size-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand px-1 text-center text-[10px] font-semibold leading-4 text-brand-ink">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="flex items-center justify-between gap-4 px-2.5 py-2">
          <p className="text-[13px] font-semibold text-ink">Notifications</p>
          {unreadCount > 0 && (
            <button
              className="text-[11px] font-medium text-brand hover:text-brand-hover"
              onClick={() => markAllRead.mutate()}
            >
              Mark all as read
            </button>
          )}
        </div>
        <div className="max-h-72 min-w-[280px] overflow-y-auto border-t border-line">
          {entries.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-[12px] text-ink-3">No notifications yet.</p>
          ) : (
            entries.slice(0, 8).map((entry: Notification) => {
              const isUnread = !entry.readAt;
              const content = (
                <span className="flex items-start gap-2 border-b border-line px-2.5 py-2.5 text-left last:border-0 hover:bg-surface-2">
                  <span className={cn("mt-1 size-2 shrink-0 rounded-full", isUnread ? "bg-brand" : "border border-line-strong")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-ink">
                        {entry.message}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-3">{formatDateTime(entry.createdAt)}</span>
                  </span>
                  {!isUnread && <Check className="mt-0.5 size-3.5 text-ink-3" />}
                </span>
              );
              return entry.link ? <Link key={entry.id} href={entry.link} onClick={() => { if (isUnread) markRead.mutate(entry.id); }}>{content}</Link> : <button key={entry.id} onClick={() => { if (isUnread) markRead.mutate(entry.id); }} className="block w-full">{content}</button>;
            })
          )}
        </div>
        <Link href="/notifications" className="block border-t border-line px-2.5 py-2 text-center text-[11px] font-medium text-brand hover:bg-surface-2">
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({
  name,
  email,
  org,
  isAdmin,
  theme,
  onToggleTheme,
  onLogout,
  onProfile,
  full,
}: {
  name: string;
  email: string;
  org: string | null;
  isAdmin: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onLogout: () => void;
  onProfile: () => void;
  full?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={full ? undefined : `Account menu for ${name}`}
          className={cn(
            "flex items-center gap-2 rounded-lg text-left transition-colors hover:bg-surface-2",
            full ? "w-full p-2" : "p-1",
          )}
        >
          <Avatar name={name} size="sm" />
          {full && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">{name}</span>
              <span className="block truncate text-[11.5px] text-ink-3">{org ?? email}</span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={full ? "start" : "end"}>
        <div className="px-2.5 py-2">
          <p className="truncate text-[13px] font-medium text-ink">{name}</p>
          <p className="truncate text-[11.5px] text-ink-3">{email}</p>
          {isAdmin && <p className="mt-1 text-[11px] font-medium text-brand">Org admin</p>}
        </div>
        <div className="my-1 h-px bg-line" />
        <DropdownMenuItem onSelect={onProfile}>
          <Settings className="size-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onToggleTheme}>
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onLogout} destructive>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

## src/components/layout/PageHeader.tsx

Reusable page title, supporting copy, and action header.

```tsx
"use client";

import type { ReactNode } from "react";

import { useScrollReveal } from "@/hooks/use-scroll-reveal";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-surface px-4 py-4 md:px-6 md:py-5">
      <div ref={ref} data-visible={visible} className="tf-scroll-reveal">
        <h1 className="tf-glossy flex items-center gap-2 font-display text-[19px] font-bold md:text-[22px]">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
```

## src/components/layout/Logo.tsx

TaskFlow wordmark component.

```tsx
import Link from "next/link";

export function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 font-display text-[16px] font-bold">
      <span className="flex size-6 items-center justify-center rounded-md bg-brand text-[13px] text-brand-ink">T</span>
      <span className="tf-glossy">TaskFlow</span>
    </Link>
  );
}
```
