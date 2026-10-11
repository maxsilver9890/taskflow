import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it
} from "vitest";

import request from "supertest";

import { prisma } from "../../src/config/prisma.js";
import { createApp } from "../../src/app.js";

function makeRedisStub() {
  return {
    status: "ready",
    ping: async () => "PONG",
    quit: async () => {}
  } as unknown as import("ioredis").default;
}

async function resetTestDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "notifications",
      "comments",
      "task_assignments",
      "tasks",
      "projects",
      "refresh_tokens",
      "org_members",
      "organizations",
      "users"
    CASCADE;
  `);
}

describe("Organization API integration tests", () => {
  const app = createApp(makeRedisStub());

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns the caller's own organization with a member count", async () => {
    const register = await request(app).post("/auth/register").send({
      email: "org-admin@example.com",
      name: "Org Admin",
      password: "Password123!",
      organizationName: "Northstar Labs"
    });

    expect(register.status).toBe(201);

    const { accessToken, organization } = register.body;

    const res = await request(app)
      .get("/organizations/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: organization.id,
        name: "Northstar Labs",
        memberCount: 1
      })
    );
  });

  it("lists every member of the caller's organization", async () => {
    const register = await request(app).post("/auth/register").send({
      email: "org-admin2@example.com",
      name: "Org Admin",
      password: "Password123!",
      organizationName: "Blue Orbit Studio"
    });

    expect(register.status).toBe(201);

    const { accessToken, organization, user } = register.body;

    // A second member is added directly via Prisma rather than through the
    // API — there's no "invite/join org" endpoint yet (see roadmap item B1),
    // so this is the only way to produce a multi-member org for the test.
    const secondUser = await prisma.user.create({
      data: {
        email: "member2@example.com",
        name: "Second Member",
        passwordHash: "not-a-real-hash"
      }
    });

    await prisma.orgMember.create({
      data: {
        organizationId: organization.id,
        userId: secondUser.id,
        role: "MEMBER"
      }
    });

    const res = await request(app)
      .get("/organizations/me/members")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: user.id, role: "ORG_ADMIN" }),
        expect.objectContaining({ userId: secondUser.id, role: "MEMBER" })
      ])
    );
  });

  it("never returns another organization's members", async () => {
    const orgA = await request(app).post("/auth/register").send({
      email: "tenant-a@example.com",
      name: "Tenant A Admin",
      password: "Password123!",
      organizationName: "Tenant A Org"
    });

    expect(orgA.status).toBe(201);

    const orgB = await request(app).post("/auth/register").send({
      email: "tenant-b@example.com",
      name: "Tenant B Admin",
      password: "Password123!",
      organizationName: "Tenant B Org"
    });

    expect(orgB.status).toBe(201);

    const resA = await request(app)
      .get("/organizations/me/members")
      .set("Authorization", `Bearer ${orgA.body.accessToken}`);

    expect(resA.status).toBe(200);
    expect(resA.body.total).toBe(1);
    expect(resA.body.data[0].userId).toBe(orgA.body.user.id);

    const resAOrg = await request(app)
      .get("/organizations/me")
      .set("Authorization", `Bearer ${orgA.body.accessToken}`);

    expect(resAOrg.body.id).toBe(orgA.body.organization.id);
    expect(resAOrg.body.id).not.toBe(orgB.body.organization.id);
  });

  it("returns 401 without a valid access token", async () => {
    const res = await request(app).get("/organizations/me");

    expect(res.status).toBe(401);
  });
});
