import { PrismaClient } from "@prisma/client";
import { assertSafeTestDatabase } from "./database-safety.js";

assertSafeTestDatabase();
export const testPrisma = new PrismaClient();

export async function resetTestDatabase(client: PrismaClient = testPrisma): Promise<void> {
  assertSafeTestDatabase();
  await client.$executeRawUnsafe(`
    TRUNCATE TABLE
      "notifications",
      "organization_invitations",
      "comments",
      "task_assignments",
      "tasks",
      "projects",
      "refresh_tokens",
      "email_verification_otps",
      "password_reset_tokens",
      "pending_registrations",
      "org_members",
      "organizations",
      "users"
    CASCADE;
  `);
}

export async function disconnectTestDatabase(): Promise<void> {
  await testPrisma.$disconnect();
}
