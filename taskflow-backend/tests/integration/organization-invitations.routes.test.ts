import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Queue } from "bullmq";
import { prisma } from "../../src/config/prisma.js";
import { createApp } from "../../src/app.js";
import { setOrganizationEmailQueue } from "../../src/organizations/organization.controller.js";
import { hashToken, signAccessToken } from "../../src/lib/jwt.js";
import { resetTestDatabase } from "../helpers/test-db.js";

const redisStub = () => ({ status: "ready", ping: async () => "PONG", quit: async () => {} }) as unknown as import("ioredis").default;

describe("organization invitation lifecycle", () => {
  const app = createApp(redisStub());
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const queue = { add: vi.fn(async () => ({ id: "email-job" })) } as unknown as Queue;
  let organizationId: string;
  let adminId: string;
  let inviteeId: string;
  let adminToken: string;
  let inviteeToken: string;
  let emailJob: { data: { inviteUrl: string } } | undefined;

  async function resetDatabase() {
    await resetTestDatabase(prisma);
    const org = await prisma.organization.create({ data: { name: "Orbit" } });
    organizationId = org.id;
    const admin = await prisma.user.create({ data: { email: "admin@orbit.test", name: "Admin", passwordHash: "unused", emailVerified: true } });
    adminId = admin.id;
    const invitee = await prisma.user.create({ data: { email: "member@orbit.test", name: "Member", passwordHash: "unused", emailVerified: true } });
    inviteeId = invitee.id;
    await prisma.orgMember.create({ data: { organizationId, userId: adminId, role: "ORG_ADMIN" } });
    adminToken = signAccessToken({ sub: adminId, orgId: organizationId, role: "ORG_ADMIN", emailVerified: true });
    inviteeToken = signAccessToken({ sub: inviteeId, orgId: organizationId, role: "MEMBER", emailVerified: true });
    queue.add = vi.fn(async (_name: string, job: unknown) => { emailJob = job as typeof emailJob; return { id: "email-job" }; }) as never;
    setOrganizationEmailQueue(queue);
    process.env.FRONTEND_URL = "https://frontend.orbit.test/";
    emailJob = undefined;
  }

  async function invite(email = "member@orbit.test") {
    const result = await request(app).post("/organizations/me/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email, role: "MEMBER" });
    expect(result.status).toBe(201);
    const inviteUrl = emailJob?.data.inviteUrl;
    expect(inviteUrl).toBeTruthy();
    return new URL(inviteUrl!).pathname.split("/").at(-1)!;
  }

  beforeEach(resetDatabase);
  afterAll(async () => {
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
    await prisma.$disconnect();
  });

  it("persists notifications, sends the configured frontend URL, and exposes only safe invitation details", async () => {
    const rawToken = await invite();
    expect(emailJob?.data.inviteUrl).toBe(`https://frontend.orbit.test/invitations/${rawToken}`);
    const notification = await prisma.notification.findFirstOrThrow({ where: { userId: inviteeId } });
    expect(notification.link).toBe(`/invitations/${rawToken}`);

    const lookup = await request(app).get(`/organizations/invitations/${rawToken}`);
    expect(lookup.status).toBe(200);
    expect(lookup.body).toMatchObject({ organizationName: "Orbit", email: "member@orbit.test", role: "MEMBER", status: "PENDING" });
    expect(lookup.body).not.toHaveProperty("tokenHash");
    expect(JSON.stringify(lookup.body)).not.toContain(hashToken(rawToken));
  });

  it("rejects mismatched and expired invitations, then allows re-inviting after rejection", async () => {
    const rawToken = await invite();
    const other = await prisma.user.create({ data: { email: "other@orbit.test", name: "Other", passwordHash: "unused", emailVerified: true } });
    const otherToken = signAccessToken({ sub: other.id, orgId: organizationId, role: "MEMBER", emailVerified: true });
    const mismatchedAccept = await request(app).post(`/organizations/invitations/${rawToken}/accept`).set("Authorization", `Bearer ${otherToken}`);
    expect(mismatchedAccept.status).toBe(403);
    const mismatch = await request(app).post(`/organizations/invitations/${rawToken}/reject`).set("Authorization", `Bearer ${otherToken}`);
    expect(mismatch.status).toBe(403);

    const rejected = await request(app).post(`/organizations/invitations/${rawToken}/reject`).set("Authorization", `Bearer ${inviteeToken}`);
    expect(rejected.status).toBe(200);
    const reissuedToken = await invite();
    expect(reissuedToken).not.toBe(rawToken);

    await prisma.organizationInvitation.update({ where: { tokenHash: hashToken(reissuedToken) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const lookup = await request(app).get(`/organizations/invitations/${reissuedToken}`);
    expect(lookup.body.status).toBe("EXPIRED");
    const accept = await request(app).post(`/organizations/invitations/${reissuedToken}/accept`).set("Authorization", `Bearer ${inviteeToken}`);
    expect(accept.status).toBe(400);
  });

  it("allows at most one of concurrent accept and reject", async () => {
    const rawToken = await invite();
    const [accepted, rejected] = await Promise.all([
      request(app).post(`/organizations/invitations/${rawToken}/accept`).set("Authorization", `Bearer ${inviteeToken}`),
      request(app).post(`/organizations/invitations/${rawToken}/reject`).set("Authorization", `Bearer ${inviteeToken}`),
    ]);
    expect([accepted.status, rejected.status].filter((status) => status === 200)).toHaveLength(1);
    const row = await prisma.organizationInvitation.findUniqueOrThrow({ where: { tokenHash: hashToken(rawToken) } });
    expect(Boolean(row.acceptedAt) && Boolean(row.rejectedAt)).toBe(false);
  });
});
