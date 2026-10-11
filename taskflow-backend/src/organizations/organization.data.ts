import type { PrismaClient } from "@prisma/client";

export async function findOrganizationById(db: PrismaClient, organizationId: string) {
  return db.organization.findUnique({ where: { id: organizationId } });
}
export async function countOrganizationMembers(db: PrismaClient, organizationId: string) {
  return db.orgMember.count({ where: { organizationId } });
}
export async function findOrganizationMembers(db: PrismaClient, organizationId: string) {
  return db.orgMember.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true, email: true } } } });
}
export async function findPendingInvitation(db: PrismaClient, organizationId: string, email: string) {
  return db.organizationInvitation.findFirst({ where: { organizationId, email, acceptedAt: null, cancelledAt: null, expiresAt: { gt: new Date() } } });
}
export async function createInvitation(db: PrismaClient, data: { organizationId: string; inviterId: string; email: string; role: "ORG_ADMIN" | "MEMBER"; tokenHash: string; expiresAt: Date }) {
  return db.organizationInvitation.create({ data });
}
export async function listInvitations(db: PrismaClient, organizationId: string) {
  return db.organizationInvitation.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } });
}
export async function findInvitationByHash(db: PrismaClient, tokenHash: string) {
  return db.organizationInvitation.findUnique({ where: { tokenHash }, include: { organization: true } });
}
export async function cancelInvitation(db: PrismaClient, organizationId: string, id: string) {
  return db.organizationInvitation.updateMany({ where: { id, organizationId, acceptedAt: null, cancelledAt: null }, data: { cancelledAt: new Date() } });
}
export async function findMember(db: PrismaClient, organizationId: string, userId: string) {
  return db.orgMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
}
export async function updateMemberRole(db: PrismaClient, organizationId: string, userId: string, role: "ORG_ADMIN" | "MEMBER") {
  return db.orgMember.update({ where: { organizationId_userId: { organizationId, userId } }, data: { role } });
}
export async function deleteMember(db: PrismaClient, organizationId: string, userId: string) {
  return db.orgMember.delete({ where: { organizationId_userId: { organizationId, userId } } });
}
