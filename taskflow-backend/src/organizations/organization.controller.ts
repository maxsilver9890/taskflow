import type { NextFunction, Request, Response } from "express";
import type { Queue } from "bullmq";
import { prisma } from "../config/prisma.js";
import type { EmailJobPayload } from "../jobs/queue.js";
import * as OrganizationService from "./organization.service.js";
import { createOrganizationSchema, inviteSchema, roleSchema, tokenSchema, transferAdminSchema } from "./organization.schemas.js";

let emailQueue: Queue<EmailJobPayload> | undefined;
export function setOrganizationEmailQueue(queue: Queue<EmailJobPayload>) { emailQueue = queue; }
function auth(req: Request) { if (!req.auth) throw new Error("Authentication context missing"); return req.auth; }

export async function createOrganizationHandler(req: Request, res: Response, next: NextFunction) {
  try { const a = auth(req); const { body } = createOrganizationSchema.parse({ body: req.body }); res.status(201).json(await OrganizationService.createOrganization(prisma, a.userId, body)); } catch (e) { next(e); }
}
export async function leaveOrganizationHandler(req: Request, res: Response, next: NextFunction) {
  try { const a = auth(req); await OrganizationService.leaveOrganization(prisma, a.orgId, a.userId); res.status(204).send(); } catch (e) { next(e); }
}
export async function transferAdminHandler(req: Request, res: Response, next: NextFunction) {
  try { const a = auth(req); const { body } = transferAdminSchema.parse({ body: req.body }); res.status(200).json(await OrganizationService.transferAdmin(prisma, a.orgId, a.userId, body.userId)); } catch (e) { next(e); }
}
export async function deleteOrganizationHandler(req: Request, res: Response, next: NextFunction) {
  try { const a = auth(req); await OrganizationService.deleteOrganization(prisma, a.orgId, a.userId); res.status(204).send(); } catch (e) { next(e); }
}

export async function getMyOrganizationHandler(req: Request, res: Response, next: NextFunction) {
  try { const a = auth(req); res.status(200).json(await OrganizationService.getOrganization(prisma, a.orgId)); } catch (e) { next(e); }
}
export async function listMyOrganizationMembersHandler(req: Request, res: Response, next: NextFunction) {
  try { const a = auth(req); res.status(200).json(await OrganizationService.listOrganizationMembers(prisma, a.orgId)); } catch (e) { next(e); }
}
export async function inviteMemberHandler(req: Request, res: Response, next: NextFunction) {
  try { const a = auth(req); const { body } = inviteSchema.parse({ body: req.body }); res.status(201).json(await OrganizationService.inviteMember(prisma, emailQueue, a.orgId, a.userId, a.role, body)); } catch (e) { next(e); }
}
export async function listInvitationsHandler(req: Request, res: Response, next: NextFunction) {
  try { const a = auth(req); res.status(200).json(await OrganizationService.getInvitations(prisma, a.orgId, a.userId)); } catch (e) { next(e); }
}
export async function cancelInvitationHandler(req: Request, res: Response, next: NextFunction) {
  try { const a = auth(req); await OrganizationService.cancelInvite(prisma, a.orgId, a.userId, String(req.params.id)); res.status(204).send(); } catch (e) { next(e); }
}
export async function acceptInvitationHandler(req: Request, res: Response, next: NextFunction) {
  try { const a = auth(req); const token = typeof req.params.token === "string" ? req.params.token : tokenSchema.parse({ body: req.body }).body.token; res.status(200).json(await OrganizationService.acceptInvitation(prisma, a.userId, token)); } catch (e) { next(e); }
}
export async function updateMemberRoleHandler(req: Request, res: Response, next: NextFunction) {
  try { const a = auth(req); const { body } = roleSchema.parse({ body: req.body }); res.status(200).json(await OrganizationService.changeMemberRole(prisma, a.orgId, a.userId, a.role, String(req.params.userId), body.role)); } catch (e) { next(e); }
}
export async function removeMemberHandler(req: Request, res: Response, next: NextFunction) {
  try { const a = auth(req); await OrganizationService.removeMember(prisma, a.orgId, a.userId, a.role, String(req.params.userId)); res.status(204).send(); } catch (e) { next(e); }
}
