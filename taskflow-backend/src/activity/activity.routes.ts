import { Router } from "express";

import { authenticate, requireVerifiedEmail } from "../middleware/authenticate.js";
import { listCommentActivityHandler } from "./activity.controller.js";

export function createActivityRouter(): Router {
  const router = Router();
  router.use(authenticate, requireVerifiedEmail);
  router.get("/comments", listCommentActivityHandler);
  return router;
}
