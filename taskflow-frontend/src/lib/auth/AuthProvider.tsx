"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { authApi } from "@/lib/api/services";
import type { AuthUser, LoginInput, OrgRole, RegisterInput } from "@/lib/api/types";
import {
  clearSession,
  decodeAccessToken,
  parseSession,
  readSessionRaw,
  subscribeSession,
  updateActiveOrganization,
  updateTokens,
  writeSession,
} from "./session";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  orgId: string | null;
  organizationName: string | null;
  role: OrgRole | null;
  isAdmin: boolean;
  /**
   * The authoritative verification flag for the current session, decoded
   * straight from the access token's JWT claim (see TokenClaims). `true`
   * while status isn't "authenticated" so callers that only care about
   * blocking unverified *authenticated* users don't need a redundant status
   * check.
   */
  emailVerified: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  /** Redeem a 6-digit OTP. On success, writes the fresh (now-verified) token pair. */
  verifyEmail: (otp: string) => Promise<void>;
  /** Queue a new OTP. Returns the server-authoritative cooldown in seconds. */
  resendVerification: () => Promise<{ cooldownSeconds: number }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const noopSubscribe = () => () => {};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // `hydrated` is false during SSR/hydration and true afterwards, so we never
  // flash the login screen for a user who is actually signed in.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const raw = useSyncExternalStore(subscribeSession, readSessionRaw, () => null);
  const session = useMemo(() => parseSession(raw), [raw]);
  const claims = useMemo(() => (session ? decodeAccessToken(session.accessToken) : null), [session]);

  const login = useCallback(
    async (input: LoginInput) => {
      const res = await authApi.login(input);
      queryClient.clear();
      writeSession({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user });
    },
    [queryClient],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await authApi.register(input);
      queryClient.clear();
      writeSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: { id: res.user.id, email: res.user.email, name: res.user.name, emailVerified: res.user.emailVerified },
        organizationName: res.organization.name,
      });
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    const current = parseSession(readSessionRaw());
    if (current) {
      try {
        // Revokes the refresh token server-side. Logout is idempotent; failures
        // (offline, etc.) must never block signing out locally.
        await authApi.logout(current.refreshToken);
      } catch {
        /* ignore */
      }
    }
    clearSession();
    queryClient.clear();
  }, [queryClient]);

  const verifyEmail = useCallback(async (otp: string) => {
    const res = await authApi.verifyEmail({ otp });
    // A fresh token pair with emailVerified: true already baked into its
    // claims — writing it is what flips `emailVerified` below reactively,
    // without a page reload or a separate profile refetch.
    updateTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
  }, []);

  const resendVerification = useCallback(async () => {
    const res = await authApi.resendVerification();
    return { cooldownSeconds: res.cooldownSeconds };
  }, []);

  const switchOrganization = useCallback(async (organizationId: string) => {
    const res = await authApi.selectOrganization(organizationId);
    updateActiveOrganization(res, res.organization);
    // Organization-scoped keys intentionally stay stable across orgs. Drop
    // the old snapshots and immediately refetch active views under the new
    // token rather than allowing data from the previous org to linger.
    queryClient.clear();
    await queryClient.refetchQueries({ type: "active" });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const status: AuthStatus = !hydrated ? "loading" : session ? "authenticated" : "unauthenticated";
    return {
      status,
      user: session?.user ?? null,
      orgId: claims?.orgId ?? session?.activeOrganization?.id ?? null,
      organizationName: session?.activeOrganization?.name ?? session?.organizationName ?? null,
      role: claims?.role ?? session?.activeOrganization?.role ?? null,
      isAdmin: (claims?.role ?? session?.activeOrganization?.role) === "ORG_ADMIN",
      emailVerified: claims?.emailVerified ?? true,
      login,
      register,
      logout,
      switchOrganization,
      verifyEmail,
      resendVerification,
    };
  }, [hydrated, session, claims, login, register, logout, switchOrganization, verifyEmail, resendVerification]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** For code that only renders when authenticated (inside the app shell). */
export function useCurrentUser(): AuthUser {
  const { user } = useAuth();
  if (!user) throw new Error("useCurrentUser called while signed out");
  return user;
}
