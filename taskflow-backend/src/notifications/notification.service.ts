import type { PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import * as NotificationData from "./notification.data.js";

export function listNotifications(db: PrismaClient, userId: string) {
  return NotificationData.listForUser(db, userId);
}

export async function markNotificationRead(db: PrismaClient, userId: string, id: string) {
  const result = await NotificationData.markRead(db, userId, id);
  if (!result.count) {
    throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
  }
}

export function markAllNotificationsRead(db: PrismaClient, userId: string) {
  return NotificationData.markAllRead(db, userId);
}
