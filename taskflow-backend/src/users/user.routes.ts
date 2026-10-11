import { Router } from "express";

import { authenticate, requireVerifiedEmail } from "../middleware/authenticate.js";
import {
  changePasswordHandler,
  getMeHandler,
  listMyOrganizationsHandler,
  updateMeHandler
} from "./user.controller.js";

export function createUserRouter(): Router {
  const router = Router();
  router.use(authenticate, requireVerifiedEmail);
  router.get("/me", getMeHandler);
  router.get("/me/organizations", listMyOrganizationsHandler);
  router.patch("/me", updateMeHandler);
  router.post("/me/change-password", changePasswordHandler);
  return router;
}
