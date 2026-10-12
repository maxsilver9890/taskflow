import { config } from "@/lib/config";
import { clearSession, decodeAccessToken, readSession, updateTokens } from "@/lib/auth/session";
import { ApiError, parseErrorBody } from "./errors";
import type { RefreshResponse } from "./types";

type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  /** Skip the Authorization header and the refresh-on-401 behaviour. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(config.apiUrl + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function rawRequest<T>(path: string, opts: RequestOptions, accessToken: string | null): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken && !opts.anonymous) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Network request failed");
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) throw parseErrorBody(res.status, payload);
  return payload as T;
}

// ── Token refresh ────────────────────────────────────────────────────────────
//
// The backend rotates refresh tokens and treats *replaying a revoked token* as
// theft: it revokes every refresh token for that user. So we must never send
// the same refresh token twice. Two guards:
//   1. single-flight within a tab (one shared in-flight promise)
//   2. a cross-tab Web Lock, re-reading storage inside the lock so a tab that
//      lost the race adopts the tokens the winner just stored.

let inflight: Promise<string> | null = null;

const EXPIRY_SKEW_MS = 30_000;

function tokenIsFresh(token: string): boolean {
  const claims = decodeAccessToken(token);
  return !!claims && claims.expMs - Date.now() > EXPIRY_SKEW_MS;
}

async function doRefresh(staleAccessToken: string | null, force = false): Promise<string> {
  const session = readSession();
  if (!session) throw new ApiError(401, "TOKEN_MISSING", "Not signed in");

  // Another tab may already have rotated the tokens while we waited for the
  // lock. Skipped when `force` is set — a forced refresh is specifically for
  // claims that can go stale independently of expiry (emailVerified), so
  // "the token isn't expiring soon" must not short-circuit it.
  if (!force && session.accessToken !== staleAccessToken && tokenIsFresh(session.accessToken)) {
    return session.accessToken;
  }

  try {
    const tokens = await rawRequest<RefreshResponse>(
      "/auth/refresh",
      { method: "POST", body: { refreshToken: session.refreshToken }, anonymous: true },
      null,
    );
    updateTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    return tokens.accessToken;
  } catch (err) {
    // A definitive auth failure means the session is over. Transient errors
    // (network, 429, 5xx) leave the stored session intact so the user can retry.
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      clearSession();
    }
    throw err;
  }
}

/**
 * Unconditionally calls POST /auth/refresh and writes the resulting tokens,
 * even if the current access token isn't near expiry. refreshAccessToken()
 * deliberately skips the network round-trip when the token still looks
 * fresh (expiry-only check) — which is right for the common "token about to
 * expire" case, but wrong for a claim like emailVerified that can change
 * independently of expiry (e.g. the user verified in another tab). Used by
 * the verify-email screen to recover from EMAIL_ALREADY_VERIFIED without a
 * full reload.
 */
export async function forceRefreshTokens(): Promise<string> {
  // Routed through the same single-flight + cross-tab lock as a normal
  // refresh (not a direct doRefresh(..., true) call) — concurrently rotating
  // the same refresh token from two call sites would have the backend treat
  // the loser as token theft and revoke every session.
  return refreshAccessToken(null, true);
}

export async function refreshAccessToken(staleAccessToken: string | null, force = false): Promise<string> {
  if (inflight) return inflight;

  const run = () => doRefresh(staleAccessToken, force);
  const promise: Promise<string> =
    typeof navigator !== "undefined" && navigator.locks
      ? new Promise<string>((resolve, reject) => {
          void navigator.locks.request("taskflow-token-refresh", async () => {
            try {
              resolve(await run());
            } catch (err) {
              reject(err instanceof Error ? err : new Error(String(err)));
            }
          });
        })
      : run();

  inflight = promise.finally(() => {
    inflight = null;
  });
  return inflight;
}

// ── Public request function ──────────────────────────────────────────────────

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (opts.anonymous) return rawRequest<T>(path, opts, null);

  const session = readSession();
  if (!session) throw new ApiError(401, "TOKEN_MISSING", "Not signed in");

  let token = session.accessToken;

  // Refresh proactively if the token is about to expire.
  if (!tokenIsFresh(token)) {
    token = await refreshAccessToken(token);
  }

  try {
    return await rawRequest<T>(path, opts, token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && !NON_AUTH_401_CODES.has(err.code)) {
      // Access token rejected (expired early, clock skew…). Refresh once and retry.
      const fresh = await refreshAccessToken(token);
      return rawRequest<T>(path, opts, fresh);
    }
    throw err;
  }
}

/** Send one authenticated request with a freshly obtained token without storing it in browser session state. */
export async function apiWithAccessToken<T>(
  path: string,
  opts: RequestOptions,
  accessToken: string,
): Promise<T> {
  if (!accessToken) throw new ApiError(401, "TOKEN_MISSING", "Not signed in");
  return rawRequest<T>(path, opts, accessToken);
}

/**
 * 401s whose cause is NOT "this access token is stale" — refreshing and
 * blindly retrying would just resend the same (still-wrong) request body,
 * silently burning a second request against the auth rate limiter and an
 * unnecessary refresh-token rotation for no benefit. OTP_INVALID/OTP_EXPIRED
 * (POST /auth/verify-email — a wrong or expired code, not a bad token) join
 * the pre-existing RATE_LIMIT_EXCEEDED exemption here.
 */
const NON_AUTH_401_CODES = new Set(["RATE_LIMIT_EXCEEDED", "OTP_INVALID", "OTP_EXPIRED"]);
