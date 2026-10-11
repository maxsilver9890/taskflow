
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

async function getVerifiedToken(
  app: ReturnType<typeof createApp>,
  email: string,
  password: string,
  userId: string
): Promise<string> {
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true }
  });

  const login = await request(app)
    .post("/auth/login")
    .send({ email, password });

  if (login.status !== 200) {
    throw new Error(
      `Expected verified login to return 200, received ${login.status}: ${JSON.stringify(login.body)}`
    );
  }

  return login.body.accessToken as string;
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
    const email = "org-admin@example.com";
    const password = "Password123!";

    const register = await request(app)
      .post("/auth/register")
      .send({
        email,
        name: "Org Admin",
        password,
        organizationName: "Northstar Labs"
      });

    expect(register.status).toBe(201);

    const accessToken = await getVerifiedToken(
      app,
      email,
      password,
      register.body.user.id
    );

    const { organization } = register.body;

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
    const email = "org-admin2@example.com";
    const password = "Password123!";

    const register = await request(app)
      .post("/auth/register")
      .send({
        email,
        name: "Org Admin",
        password,
        organizationName: "Blue Orbit Studio"
      });

    expect(register.status).toBe(201);

    const { organization, user } = register.body;

    const accessToken = await getVerifiedToken(
      app,
      email,
      password,
      user.id
    );

    // Add a second member directly through Prisma because this test
    // does not create the member through an invitation flow.
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
    const emailA = "tenant-a@example.com";
    const emailB = "tenant-b@example.com";
    const password = "Password123!";

    const orgA = await request(app)
      .post("/auth/register")
      .send({
        email: emailA,
        name: "Tenant A Admin",
        password,
        organizationName: "Tenant A Org"
      });

    expect(orgA.status).toBe(201);

    const orgB = await request(app)
      .post("/auth/register")
      .send({
        email: emailB,
        name: "Tenant B Admin",
        password,
        organizationName: "Tenant B Org"
      });

    expect(orgB.status).toBe(201);

    const tokenA = await getVerifiedToken(
      app,
      emailA,
      password,
      orgA.body.user.id
    );

    await getVerifiedToken(
      app,
      emailB,
      password,
      orgB.body.user.id
    );

    const resA = await request(app)
      .get("/organizations/me/members")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(resA.status).toBe(200);
    expect(resA.body.total).toBe(1);
    expect(resA.body.data[0].userId).toBe(orgA.body.user.id);

    const resAOrg = await request(app)
      .get("/organizations/me")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(resAOrg.status).toBe(200);
    expect(resAOrg.body.id).toBe(orgA.body.organization.id);
    expect(resAOrg.body.id).not.toBe(orgB.body.organization.id);
  });

  it("returns 401 without a valid access token", async () => {
    const res = await request(app).get("/organizations/me");

    expect(res.status).toBe(401);
  });
});
