import type { PrismaClient } from "@prisma/client";

const profileSelect = {
  id: true,
  name: true,
  email: true,
  orgMemberships: {
    orderBy: { createdAt: "asc" as const },
    take: 1,
    select: {
      role: true,
      organization: { select: { id: true, name: true } }
    }
  }
} as const;

export function findUserProfile(db: PrismaClient, userId: string, organizationId?: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      ...profileSelect,
      orgMemberships: {
        ...profileSelect.orgMemberships,
        ...(organizationId ? { where: { organizationId } } : {})
      }
    }
  });
}

export function findUserOrganizations(db: PrismaClient, userId: string) {
  return db.orgMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      organization: { select: { id: true, name: true } }
    }
  });
}

export function findUserForPasswordChange(db: PrismaClient, userId: string) {
  return db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
}

export function updateUserName(db: PrismaClient, userId: string, name: string) {
  return db.user.update({ where: { id: userId }, data: { name }, select: profileSelect });
}

export function updateUserPassword(db: PrismaClient, userId: string, passwordHash: string) {
  return db.user.update({ where: { id: userId }, data: { passwordHash } });
}
