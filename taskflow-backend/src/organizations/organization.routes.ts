import { Router } from "express";

import { authenticate, requireVerifiedEmail } from "../middleware/authenticate.js";
import {
  getMyOrganizationHandler,
  listMyOrganizationMembersHandler,
  inviteMemberHandler,
  listInvitationsHandler,
  cancelInvitationHandler,
  acceptInvitationHandler,
  rejectInvitationHandler,
  updateMemberRoleHandler,
  removeMemberHandler,
  createOrganizationHandler,
  leaveOrganizationHandler,
  transferAdminHandler,
  deleteOrganizationHandler,
  getPublicInvitationHandler
} from "./organization.controller.js";

export function createOrganizationRouter(): Router {
  const router = Router();

  router.get("/invitations/:token", getPublicInvitationHandler);

  router.use(authenticate, requireVerifiedEmail);
  router.post("/", createOrganizationHandler);
  router.delete("/me/membership", leaveOrganizationHandler);
  router.post("/me/transfer-admin", transferAdminHandler);
  router.delete("/me", deleteOrganizationHandler);

  // "me" rather than "/:id" — the caller's org is always resolved from the
  // verified JWT (req.auth.orgId), so there is no id to validate or spoof.
  router.get("/me", getMyOrganizationHandler);
  router.get("/me/members", listMyOrganizationMembersHandler);
  router.post("/me/invitations", inviteMemberHandler);
  router.get("/me/invitations", listInvitationsHandler);
  router.delete("/me/invitations/:id", cancelInvitationHandler);
  router.patch("/me/members/:userId", updateMemberRoleHandler);
  router.delete("/me/members/:userId", removeMemberHandler);
  router.post("/invitations/accept", acceptInvitationHandler);
  router.post("/invitations/:token/reject", rejectInvitationHandler);
  router.post("/invitations/:token/accept", acceptInvitationHandler);

  return router;
}
