import { PrismaClient } from "@prisma/client";

export const testPrisma = new PrismaClient();

export async function resetTestDatabase(): Promise<void> {
  await testPrisma.$executeRawUnsafe(`
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

export async function disconnectTestDatabase(): Promise<void> {
  await testPrisma.$disconnect();
}