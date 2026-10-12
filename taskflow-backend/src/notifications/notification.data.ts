import type { PrismaClient } from "@prisma/client";

export async function listForUser(db: PrismaClient, userId: string) {
  const [data, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    }),
    db.notification.count({ where: { userId, readAt: null } })
  ]);

  return { data, unreadCount, total: data.length };
}

export function markRead(db: PrismaClient, userId: string, id: string) {
  return db.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() }
  });
}

export function markAllRead(db: PrismaClient, userId: string) {
  return db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() }
  });
}


export function createNotification(
  db: PrismaClient,
  data: {
    userId: string;
    organizationId: string;
    organizationName: string;
    title: string;
    message: string;
    link: string;
  },
) {
  return db.notification.create({ data });
}
