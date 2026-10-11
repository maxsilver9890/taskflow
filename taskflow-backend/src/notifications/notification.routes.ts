import { Router } from "express";
import { authenticate, requireVerifiedEmail } from "../middleware/authenticate.js";
import {
  listNotificationsHandler,
  markAllNotificationsReadHandler,
  markNotificationReadHandler
} from "./notification.controller.js";

export function createNotificationRouter(): Router {
  const router = Router();
  router.use(authenticate, requireVerifiedEmail);
  router.get("/", listNotificationsHandler);
  router.patch("/:id/read", markNotificationReadHandler);
  router.post("/read-all", markAllNotificationsReadHandler);
  return router;
}
