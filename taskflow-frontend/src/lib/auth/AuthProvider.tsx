"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";

import { authApi } from "@/lib/api/services";
import type { AuthUser, LoginInput, OrgRole, RegisterInput } from "@/lib/api/types";
import { firebaseAuth } from "@/lib/firebase";
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

const PENDING_REGISTRATION_KEY = "taskflow.pendingFirebaseRegistration";

type PendingRegistration = {
  email: string;
  name: string;
  organizationName: string;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  orgId: string | null;
  organizationName: string | null;
  role: OrgRole | null;
  isAdmin: boolean;
  emailVerified: boolean;
  resendFirebaseVerification: (input: LoginInput) => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  /** Legacy OTP verification remains available for existing accounts. */
  verifyEmail: (otp: string) => Promise<void>;
  /** Legacy OTP resend remains available for existing accounts. */
  resendVerification: () => Promise<{ cooldownSeconds: number }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const noopSubscribe = () => () => {};

function verificationActionSettings() {
  return {
    // Firebase verifies the address on its hosted action page, then returns
    // the user to this page so TaskFlow can exchange the verified ID token.
    url: `${window.location.origin}/verify-email`,
  };
}

function pendingRegistrationFromStorage(): PendingRegistration | null {
  try {
    const value = sessionStorage.getItem(PENDING_REGISTRATION_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<PendingRegistration>;
    if (
      typeof parsed.email !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.organizationName !== "string"
    ) return null;
    return {
      email: parsed.email,
      name: parsed.name,
      organizationName: parsed.organizationName,
    };
  } catch {
    return null;
  }
}

async function exchangeFirebaseUser(user: FirebaseUser, pending?: PendingRegistration | null) {
  await user.reload();
  if (!user.emailVerified || !user.email) {
    throw new Error("Please verify your email using the link we sent before signing in.");
  }

  const idToken = await user.getIdToken(true);
  const result = await authApi.firebaseExchange({
    idToken,
    ...(pending?.name ? { name: pending.name } : user.displayName ? { name: user.displayName } : {}),
    ...(pending?.organizationName ? { organizationName: pending.organizationName } : {}),
  });

  writeSession({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
    organizationName: result.organization.name,
  });

  if (typeof window !== "undefined") {
    sessionStorage.removeItem(PENDING_REGISTRATION_KEY);
    sessionStorage.removeItem("taskflow.pendingRegistrationEmail");
  }
}

function isFirebaseCredentialFailure(error: unknown): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error)
  ) {
    return false;
  }

  const code = (error as { code?: unknown }).code;

  return (
    typeof code === "string" &&
    [
      "auth/invalid-credential",
      "auth/user-not-found",
      "auth/wrong-password",
    ].includes(code)
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const raw = useSyncExternalStore(subscribeSession, readSessionRaw, () => null);
  const session = useMemo(() => parseSession(raw), [raw]);
  const claims = useMemo(
    () => (session ? decodeAccessToken(session.accessToken) : null),
    [session],
  );

  const login = useCallback(async (input: LoginInput) => {
    const email = input.email.trim().toLowerCase();

    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, input.password);
      await credential.user.reload();

      if (!credential.user.emailVerified) {
        throw new Error("Your email isn't verified yet. Open the verification link we sent to your inbox, then sign in again.");
      }

      queryClient.clear();
      await exchangeFirebaseUser(credential.user, pendingRegistrationFromStorage());
      return;
    } catch (error) {
      // Preserve sign-in for legacy TaskFlow accounts that have not been
      // migrated to Firebase. Do not fall back for unverified Firebase users
      // or for backend errors such as EMAIL_IN_USE.
      if (!isFirebaseCredentialFailure(error)) {
      throw error;
    }
    }

    const res = await authApi.login({ email, password: input.password });
    queryClient.clear();
    writeSession({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      user: res.user,
    });
  }, [queryClient]);

  const resendFirebaseVerification = useCallback(
    async (input: LoginInput) => {
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        input.email.trim().toLowerCase(),
        input.password,
      );

      await credential.user.reload();

      if (credential.user.emailVerified) {
        throw new Error("Your email is already verified. Please sign in.");
      }

      await sendEmailVerification(
        credential.user,
        verificationActionSettings(),
      );
    },
    [],
  );


  const register = useCallback(async (input: RegisterInput) => {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const organizationName = input.organizationName.trim();

    const credential = await createUserWithEmailAndPassword(firebaseAuth, email, input.password);

    try {
      await updateProfile(credential.user, { displayName: name });
      sessionStorage.setItem(PENDING_REGISTRATION_KEY, JSON.stringify({
        email,
        name,
        organizationName,
      } satisfies PendingRegistration));
      sessionStorage.setItem("taskflow.pendingRegistrationEmail", email);
      await sendEmailVerification(credential.user, verificationActionSettings());
    } catch (error) {
      // Keep the Firebase account so the user can retry sending the
      // verification email rather than attempting to register it again.
      throw new Error(
        error instanceof Error
          ? `Your account was created, but we couldn't send the verification email: ${error.message}`
          : "Your account was created, but we couldn't send the verification email. Try again from the verification page.",
      );
    }
  }, []);

  const logout = useCallback(async () => {
    const current = parseSession(readSessionRaw());
    if (current) {
      try {
        await authApi.logout(current.refreshToken);
      } catch {
        /* local sign-out must still work when the API is unavailable */
      }
    }
    try {
      await firebaseSignOut(firebaseAuth);
    } catch {
      /* Firebase sign-out must not block local sign-out */
    }
    clearSession();
    queryClient.clear();
  }, [queryClient]);

  const verifyEmail = useCallback(async (otp: string) => {
    const res = await authApi.verifyEmail({ otp });
    updateTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
  }, []);

  const resendVerification = useCallback(async () => {
    const res = await authApi.resendVerification();
    return { cooldownSeconds: res.cooldownSeconds };
  }, []);

  const switchOrganization = useCallback(async (organizationId: string) => {
    const res = await authApi.selectOrganization(organizationId);
    updateActiveOrganization(res, res.organization);
    queryClient.clear();
    await queryClient.refetchQueries({ type: "active" });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const status: AuthStatus = !hydrated
      ? "loading"
      : session
        ? "authenticated"
        : "unauthenticated";

    return {
      status,
      user: session?.user ?? null,
      orgId: claims?.orgId ?? session?.activeOrganization?.id ?? null,
      organizationName: session?.activeOrganization?.name ?? session?.organizationName ?? null,
      role: claims?.role ?? session?.activeOrganization?.role ?? null,
      isAdmin: (claims?.role ?? session?.activeOrganization?.role) === "ORG_ADMIN",
      emailVerified: claims?.emailVerified ?? true,
      login,
      resendFirebaseVerification,
      register,
      logout,
      switchOrganization,
      verifyEmail,
      resendVerification,
    };
  }, [
    hydrated,
    session,
    claims,
    login,
    resendFirebaseVerification,
    register,
    logout,
    switchOrganization,
    verifyEmail,
    resendVerification,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function useCurrentUser(): AuthUser {
  const { user } = useAuth();
  if (!user) throw new Error("useCurrentUser called while signed out");
  return user;
}

/** Shared helpers for the Firebase verification page. */
export { exchangeFirebaseUser, pendingRegistrationFromStorage, verificationActionSettings };
