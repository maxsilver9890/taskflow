import type { PrismaClient } from "@prisma/client";

export async function listCommentActivity(
  db: PrismaClient,
  organizationId: string,
  page: number,
  limit: number,
) {
  const where = { task: { project: { organizationId } } };
  const [data, total] = await db.$transaction([
    db.comment.findMany({
      where,
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        deletedByName: true,
        author: { select: { id: true, name: true } },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            assignments: {
              select: { user: { select: { id: true, name: true } } },
            },
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.comment.count({ where }),
  ]);

  return { data, total, page, limit };
}
