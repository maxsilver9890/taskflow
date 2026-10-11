import type { AuthUser, OrgRole, TokenPair } from "@/lib/api/types";

/**
 * Session persistence.
 *
 * Tokens live in localStorage so a page reload keeps you signed in (the backend
 * returns tokens in the JSON body, not cookies). Trade-off: localStorage is
 * readable by any script on the origin, so keep the app free of untrusted
 * third-party scripts. The access token is short-lived (15 min by default) and
 * refresh tokens are rotated on every use.
 */
const KEY = "taskflow.session.v1";

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  /** Only known right after registering (login does not return it). */
  organizationName?: string;
  activeOrganization?: {
    id: string;
    name: string;
    role: OrgRole;
  };
}

export interface TokenClaims {
  userId: string;
  orgId: string;
  role: OrgRole;
  /**
   * The authoritative "can this access token reach app routes" signal — the
   * backend embeds this directly in the JWT (see requireVerifiedEmail) so it
   * stays correct across tabs/reloads without an extra profile fetch, and is
   * refreshed to true the moment POST /auth/verify-email succeeds (that call
   * returns a brand-new token pair, written via updateTokens()).
   */
  emailVerified: boolean;
  /** Expiry as epoch milliseconds. */
  expMs: number;
}

const listeners = new Set<() => void>();

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Raw stored string – a stable primitive snapshot for useSyncExternalStore. */
export function readSessionRaw(): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function parseSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readSession(): StoredSession | null {
  return parseSession(readSessionRaw());
}

export function writeSession(session: StoredSession): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage full or blocked – session simply won't persist */
  }
  listeners.forEach((l) => l());
}

export function updateTokens(tokens: Pick<TokenPair, "accessToken" | "refreshToken">): StoredSession | null {
  const current = readSession();
  if (!current) return null;
  const next = { ...current, ...tokens };
  writeSession(next);
  return next;
}

export function updateActiveOrganization(
  tokens: Pick<TokenPair, "accessToken" | "refreshToken">,
  organization: { id: string; name: string; role: OrgRole },
): StoredSession | null {
  const current = readSession();
  if (!current) return null;
  const next = { ...current, ...tokens, organizationName: organization.name, activeOrganization: organization };
  writeSession(next);
  return next;
}

export function clearSession(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** Notifies on any change made by this tab (use the `storage` event for other tabs). */
export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) listener();
  };
  if (isBrowser()) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (isBrowser()) window.removeEventListener("storage", onStorage);
  };
}

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Reads claims from the access token for UI purposes only (role-based button
 * visibility). This does NOT verify the signature – the API remains the sole
 * authority and enforces every permission server-side.
 */
export function decodeAccessToken(token: string): TokenClaims | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(base64UrlDecode(payload)) as {
      sub?: string;
      orgId?: string;
      role?: string;
      emailVerified?: boolean;
      exp?: number;
    };
    if (!json.sub || !json.orgId || !json.role || !json.exp) return null;
    return {
      userId: json.sub,
      orgId: json.orgId,
      role: json.role === "ORG_ADMIN" ? "ORG_ADMIN" : "MEMBER",
      // Tokens issued before this field existed simply won't have it — treat
      // as verified rather than locking out an existing session (matches the
      // migration's backfill: pre-existing accounts are already verified).
      emailVerified: json.emailVerified ?? true,
      expMs: json.exp * 1000,
    };
  } catch {
    return null;
  }
}
