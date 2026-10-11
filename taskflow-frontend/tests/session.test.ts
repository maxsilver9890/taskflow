import { describe, expect, it } from "vitest";

import { decodeAccessToken } from "@/lib/auth/session";

/**
 * Builds an unsigned JWT-shaped string (header.payload.signature) carrying
 * the given claims — decodeAccessToken only ever reads the payload for UI
 * purposes and never verifies the signature (the API is the sole authority),
 * so a fake signature segment is fine for these tests.
 */
function fakeToken(claims: Record<string, unknown>): string {
  const base64Url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${base64Url({ alg: "none" })}.${base64Url(claims)}.signature`;
}

const BASE_CLAIMS = {
  sub: "00000000-0000-0000-0000-000000000001",
  orgId: "00000000-0000-0000-0000-000000000002",
  role: "MEMBER",
  exp: Math.floor(Date.now() / 1000) + 900,
};

describe("decodeAccessToken — emailVerified claim", () => {
  it("reads emailVerified: false from the token", () => {
    const token = fakeToken({ ...BASE_CLAIMS, emailVerified: false });
    expect(decodeAccessToken(token)).toMatchObject({ emailVerified: false });
  });

  it("reads emailVerified: true from the token", () => {
    const token = fakeToken({ ...BASE_CLAIMS, emailVerified: true });
    expect(decodeAccessToken(token)).toMatchObject({ emailVerified: true });
  });

  it("defaults to true when the claim is absent (tokens issued before this field existed — matches the migration's backfill, never locks out an existing session)", () => {
    const token = fakeToken({ ...BASE_CLAIMS });
    expect(decodeAccessToken(token)).toMatchObject({ emailVerified: true });
  });

  it("still decodes role/org/user claims correctly alongside emailVerified", () => {
    const token = fakeToken({ ...BASE_CLAIMS, role: "ORG_ADMIN", emailVerified: false });
    expect(decodeAccessToken(token)).toMatchObject({
      userId: BASE_CLAIMS.sub,
      orgId: BASE_CLAIMS.orgId,
      role: "ORG_ADMIN",
      emailVerified: false,
    });
  });

  it("returns null for a malformed token rather than throwing", () => {
    expect(decodeAccessToken("not-a-jwt")).toBeNull();
  });

  it("returns null when required non-emailVerified claims are missing", () => {
    const token = fakeToken({ sub: BASE_CLAIMS.sub, exp: BASE_CLAIMS.exp }); // no orgId/role
    expect(decodeAccessToken(token)).toBeNull();
  });
});
