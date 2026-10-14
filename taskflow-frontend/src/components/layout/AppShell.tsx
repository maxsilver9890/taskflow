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
  { href: "/dashboard", label: "Dashboard", mobileLabel: "Home", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", mobileLabel: "Projects", icon: ListChecks },
  { href: "/tasks", label: "All tasks", mobileLabel: "Tasks", icon: ListChecks },
  { href: "/team", label: "Team", mobileLabel: "Team", icon: Users },
  { href: "/profile#organizations", label: "Organizations", mobileLabel: "Orgs", icon: Building2 },
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
    <div className="tf-neo-brutal min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-pop"
      >
        Skip to content
      </a>

      {/* Top bar (mobile) + side rail (desktop) */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b-2 border-line bg-surface px-3 md:hidden">
        <span className="shrink-0"><Logo /></span>
        <OrganizationSwitcher memberships={memberships.data?.data ?? []} currentId={orgId} compact />
        <nav aria-label="Workspace controls" className="ml-auto flex shrink-0 items-center gap-1">
          <NotificationBell />
          <UserMenu name={user.name} email={user.email} org={organizationName ?? organization.data?.name ?? null} isAdmin={isAdmin} theme={theme} onToggleTheme={toggle} onLogout={handleLogout} onProfile={() => router.push("/profile")} />
        </nav>
      </header>

      <header className="sticky top-0 z-30 hidden h-14 border-b-2 border-line bg-surface md:block">
        <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between gap-4 px-6">
          <Logo />
          <nav aria-label="Workspace controls" className="flex items-center gap-3">
            <NotificationBell />
            <OrganizationSwitcher memberships={memberships.data?.data ?? []} currentId={orgId} />
            <UserMenu name={user.name} email={user.email} org={organizationName ?? organization.data?.name ?? null} isAdmin={isAdmin} theme={theme} onToggleTheme={toggle} onLogout={handleLogout} onProfile={() => router.push("/profile")} />
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 flex-col border-r-2 border-line bg-surface px-3 py-4 md:flex">
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
          {children}
        </main>
      </div>

      {/* Bottom tab bar (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t-2 border-line bg-surface md:hidden">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[10.5px] font-medium",
                active ? "text-brand" : "text-ink-3",
              )}
            >
              <item.icon className="size-[18px]" />
              <span className="max-w-full truncate">{item.mobileLabel}</span>
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
  compact = false,
}: {
  memberships: { id: string; name: string; role: "ORG_ADMIN" | "MEMBER" }[];
  currentId: string | null;
  compact?: boolean;
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
        <button className={cn("flex min-w-[150px] items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left shadow-pop hover:bg-surface-2", compact && "min-h-9 min-w-0 max-w-[132px] flex-1 px-2 md:min-w-[150px] md:max-w-none md:flex-none tf-touch-target")} disabled={switching}>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] uppercase tracking-wide text-ink-3">Organization</span>
            <span className="block truncate text-[13px] font-medium text-ink">{current?.name ?? "Select organization"}</span>
          {current && !compact && <span className="block text-[10px] text-ink-3">{current.role === "ORG_ADMIN" ? "Org admin" : "Member"}</span>}
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
          className="relative flex size-9 shrink-0 items-center justify-center rounded-lg p-2 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink tf-touch-target"
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
        <div className="max-h-72 min-w-[280px] max-w-[calc(100vw-1rem)] overflow-y-auto border-t border-line">
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
            "flex items-center gap-2 rounded-lg border border-line bg-surface text-left shadow-pop transition-colors hover:bg-surface-2",
            full ? "w-full p-2" : "min-h-9 min-w-9 justify-center p-1 tf-touch-target",
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
