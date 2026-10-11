import type { PrismaClient } from "@prisma/client";

import { AppError } from "../lib/errors.js";
import * as OrganizationData from "./organization.data.js";
import crypto from "node:crypto";
import type { Queue } from "bullmq";
import type { EmailJobPayload } from "../jobs/queue.js";
import { hashToken } from "../lib/jwt.js";
import type { InviteBody } from "./organization.schemas.js";
import type { CreateOrganizationBody } from "./organization.schemas.js";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createOrganization(db: PrismaClient, userId: string, body: CreateOrganizationBody) {
  return db.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { name: body.name } });
    const membership = await tx.orgMember.create({
      data: { organizationId: organization.id, userId, role: "ORG_ADMIN" }
    });
    return { organization, membership };
  });
}

export async function leaveOrganization(db: PrismaClient, organizationId: string, userId: string) {
  const membership = await OrganizationData.findMember(db, organizationId, userId);
  if (!membership) throw new AppError(403, "FORBIDDEN", "You are not a member of this organization.");
  if (membership.role === "ORG_ADMIN") {
    const adminCount = await db.orgMember.count({ where: { organizationId, role: "ORG_ADMIN" } });
    const memberCount = await db.orgMember.count({ where: { organizationId } });
    if (adminCount <= 1 && memberCount > 1) {
      throw new AppError(409, "LAST_ADMIN", "Transfer admin before leaving the organization.");
    }
  }
  await db.orgMember.delete({ where: { organizationId_userId: { organizationId, userId } } });
  return { organizationId };
}

export async function transferAdmin(db: PrismaClient, organizationId: string, actorId: string, targetId: string) {
  if (actorId === targetId) throw new AppError(400, "INVALID_TRANSFER_TARGET", "Choose another organization member.");
  const actor = await OrganizationData.findMember(db, organizationId, actorId);
  if (!actor || actor.role !== "ORG_ADMIN") throw new AppError(403, "FORBIDDEN", "Only an organization admin can transfer admin.");
  const target = await OrganizationData.findMember(db, organizationId, targetId);
  if (!target) throw new AppError(404, "MEMBER_NOT_FOUND", "Target is not a member of this organization.");
  await db.$transaction([
    db.orgMember.update({ where: { organizationId_userId: { organizationId, userId: targetId } }, data: { role: "ORG_ADMIN" } }),
    db.orgMember.update({ where: { organizationId_userId: { organizationId, userId: actorId } }, data: { role: "MEMBER" } })
  ]);
  return { organizationId, previousAdminId: actorId, newAdminId: targetId };
}

export async function deleteOrganization(db: PrismaClient, organizationId: string, actorId: string) {
  const actor = await OrganizationData.findMember(db, organizationId, actorId);
  if (!actor || actor.role !== "ORG_ADMIN") throw new AppError(403, "FORBIDDEN", "Only an organization admin can delete this organization.");
  await db.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { name: true }
    });
    const members = await tx.orgMember.findMany({
      where: { organizationId },
      select: { userId: true }
    });
    if (organization && members.length) {
      await tx.notification.createMany({
        data: members.map((member) => ({
          userId: member.userId,
          // No foreign key is intentional: this is a historical snapshot
          // and must remain after the organization is deleted.
          organizationId,
          organizationName: organization.name,
          title: "Organization deleted",
          message: `The organization "${organization.name}" was deleted.`,
          link: null
        }))
      });
    }
    const projects = await tx.project.findMany({ where: { organizationId }, select: { id: true } });
    const projectIds = projects.map((p) => p.id);
    const tasks = projectIds.length ? await tx.task.findMany({ where: { projectId: { in: projectIds } }, select: { id: true } }) : [];
    const taskIds = tasks.map((t) => t.id);
    if (taskIds.length) {
      await tx.comment.deleteMany({ where: { taskId: { in: taskIds } } });
      await tx.taskAssignment.deleteMany({ where: { taskId: { in: taskIds } } });
      await tx.task.deleteMany({ where: { id: { in: taskIds } } });
    }
    if (projectIds.length) await tx.project.deleteMany({ where: { id: { in: projectIds } } });
    await tx.organizationInvitation.deleteMany({ where: { organizationId } });
    await tx.orgMember.deleteMany({ where: { organizationId } });
    await tx.organization.delete({ where: { id: organizationId } });
  });
}

/**
 * Returns the caller's own organization plus a derived member count.
 *
 * `organizationId` always comes from the verified JWT (req.auth.orgId),
 * never from client input — there is no "get organization by id" path, so
 * cross-tenant access isn't something a caller can even attempt here.
 */
export async function getOrganization(
  db: PrismaClient,
  organizationId: string
) {
  const organization = await OrganizationData.findOrganizationById(
    db,
    organizationId
  );

  if (!organization) {
    // Should be unreachable in practice (a valid JWT implies the org still
    // exists), but guard anyway rather than returning null shapes.
    throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
  }

  const memberCount = await OrganizationData.countOrganizationMembers(
    db,
    organizationId
  );

  return {
    id: organization.id,
    name: organization.name,
    createdAt: organization.createdAt,
    memberCount
  };
}

export async function listOrganizationMembers(
  db: PrismaClient,
  organizationId: string
) {
  const members = await OrganizationData.findOrganizationMembers(
    db,
    organizationId
  );

  const data = members.map((member) => ({
    userId: member.userId,
    name: member.user.name,
    email: member.user.email,
    role: member.role,
    joinedAt: member.createdAt
  }));

  return {
    data,
    total: data.length
  };
}

async function requireAdmin(db: PrismaClient, organizationId: string, userId: string) {
  const membership = await OrganizationData.findMember(db, organizationId, userId);
  if (!membership || membership.role !== "ORG_ADMIN") {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to access this resource.");
  }
}

export async function inviteMember(db: PrismaClient, queue: Queue<EmailJobPayload> | undefined, organizationId: string, inviterId: string, inviterRole: string, body: InviteBody) {
  await requireAdmin(db, organizationId, inviterId);
  const member = await db.user.findUnique({ where: { email: body.email }, select: { id: true, name: true } });
  if (member && await OrganizationData.findMember(db, organizationId, member.id)) throw new AppError(409, "ALREADY_MEMBER", "User is already a member.");
  if (await OrganizationData.findPendingInvitation(db, organizationId, body.email)) throw new AppError(409, "INVITATION_EXISTS", "An active invitation already exists.");
  const rawToken = crypto.randomBytes(32).toString("hex");
  const invitation = await OrganizationData.createInvitation(db, { organizationId, inviterId, email: body.email, role: body.role, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + INVITATION_TTL_MS) });
  const organization = await OrganizationData.findOrganizationById(db, organizationId);
  if (queue && organization) await queue.add("organization_invitation", { type: "organization_invitation", data: { invitationId: invitation.id, email: body.email, name: member?.name ?? body.email, organizationName: organization.name, inviteUrl: `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/invitations/${rawToken}` } });
  return { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt };
}

export async function getInvitations(db: PrismaClient, organizationId: string, role: string) {
  await requireAdmin(db, organizationId, role);
  const data = await OrganizationData.listInvitations(db, organizationId);
  return {
    data: data.map(({ tokenHash: _tokenHash, ...invitation }) => invitation),
    total: data.length
  };
}

export async function cancelInvite(db: PrismaClient, organizationId: string, role: string, id: string) {
  await requireAdmin(db, organizationId, role);
  const result = await OrganizationData.cancelInvitation(db, organizationId, id);
  if (!result.count) throw new AppError(404, "INVITATION_NOT_FOUND", "Invitation not found.");
}

export async function acceptInvitation(db: PrismaClient, userId: string, token: string) {
  const invitation = await OrganizationData.findInvitationByHash(db, hashToken(token));
  if (!invitation || invitation.cancelledAt || invitation.acceptedAt || invitation.expiresAt <= new Date()) throw new AppError(400, "INVITATION_INVALID", "Invitation is invalid or expired.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user || user.email !== invitation.email) throw new AppError(403, "INVITATION_EMAIL_MISMATCH", "Invitation was issued for a different email address.");
  const existingMembership = await OrganizationData.findMember(db, invitation.organizationId, userId);
  if (existingMembership) {
    throw new AppError(409, "ALREADY_MEMBER", "User is already a member.");
  }
  await db.$transaction(async (tx) => {
    await tx.orgMember.create({ data: { organizationId: invitation.organizationId, userId, role: invitation.role } });
    await tx.organizationInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
  });
  return { organizationId: invitation.organizationId, role: invitation.role };
}

export async function changeMemberRole(db: PrismaClient, organizationId: string, actorId: string, actorRole: string, userId: string, role: "ORG_ADMIN" | "MEMBER") {
  await requireAdmin(db, organizationId, actorId);
  const target = await OrganizationData.findMember(db, organizationId, userId);
  if (!target) throw new AppError(404, "MEMBER_NOT_FOUND", "Member not found.");
  if (target.role === "ORG_ADMIN" && role === "MEMBER" && (await db.orgMember.count({ where: { organizationId, role: "ORG_ADMIN" } })) <= 1) throw new AppError(409, "LAST_ADMIN", "The organization must retain an admin.");
  return OrganizationData.updateMemberRole(db, organizationId, userId, role);
}

export async function removeMember(db: PrismaClient, organizationId: string, actorId: string, actorRole: string, userId: string) {
  await requireAdmin(db, organizationId, actorId);
  if (actorId === userId) throw new AppError(409, "CANNOT_REMOVE_SELF", "You cannot remove yourself.");
  const target = await OrganizationData.findMember(db, organizationId, userId);
  if (!target) throw new AppError(404, "MEMBER_NOT_FOUND", "Member not found.");
  if (target.role === "ORG_ADMIN" && (await db.orgMember.count({ where: { organizationId, role: "ORG_ADMIN" } })) <= 1) throw new AppError(409, "LAST_ADMIN", "The last admin cannot be removed.");
  await OrganizationData.deleteMember(db, organizationId, userId);
}
