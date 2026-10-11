import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import * as NotificationService from "./notification.service.js";

function auth(req: Request) {
  if (!req.auth) throw new Error("Authentication context missing");
  return req.auth;
}

export async function listNotificationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await NotificationService.listNotifications(prisma, auth(req).userId));
  } catch (error) {
    next(error);
  }
}

export async function markNotificationReadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await NotificationService.markNotificationRead(prisma, auth(req).userId, String(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsReadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await NotificationService.markAllNotificationsRead(prisma, auth(req).userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
