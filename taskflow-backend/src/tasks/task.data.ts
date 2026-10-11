import type {
  PrismaClient,
  TaskPriority,
  TaskStatus
} from "@prisma/client";

type TaskFilters = {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  dueFrom?: Date;
  dueTo?: Date;
  projectId?: string;
};

export async function createTask(
  db: PrismaClient,
  organizationId: string,
  data: {
    projectId: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate?: Date;
  }
) {
  const project = await db.project.findFirst({
    where: {
      id: data.projectId,
      organizationId
    },
    select: { id: true }
  });

  if (!project) {
    return null;
  }

  return db.task.create({
    data: {
      projectId: data.projectId,
      title: data.title,
      // Prisma expects string | null — spread only when defined
      ...(data.description !== undefined && { description: data.description }),
      status: data.status,
      priority: data.priority,
      ...(data.dueDate !== undefined && { dueDate: data.dueDate })
    }
  });
}

function buildWhere(
  organizationId: string,
  filters: TaskFilters
) {
  return {
    project: {
      organizationId
    },

    ...(filters.projectId && {
      projectId: filters.projectId
    }),

    ...(filters.status && {
      status: filters.status
    }),

    ...(filters.priority && {
      priority: filters.priority
    }),

    ...(filters.assignee && {
      assignments: {
        some: {
          userId: filters.assignee
        }
      }
    }),

    ...(filters.dueFrom || filters.dueTo
      ? {
          dueDate: {
            ...(filters.dueFrom && { gte: filters.dueFrom }),
            ...(filters.dueTo && { lte: filters.dueTo })
          }
        }
      : {})
  };
}

export async function findTasks(
  db: PrismaClient,
  organizationId: string,
  filters: TaskFilters,
  skip: number,
  take: number
) {
  const where = buildWhere(organizationId, filters);

  const [data, total] = await db.$transaction([
    db.task.findMany({
      where,
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      skip,
      take
    }),

    db.task.count({ where })
  ]);

  return { data, total };
}

export async function findTaskById(
  db: PrismaClient,
  organizationId: string,
  id: string
) {
  return db.task.findFirst({
    where: {
      id,
      project: {
        organizationId
      }
    },
    include: {
      project: true,
      assignments: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      },
      comments: true
    }
  });
}

export async function findTaskByIdOnly(
  db: PrismaClient,
  id: string
) {
  return db.task.findUnique({
    where: { id },
    include: {
      project: true
    }
  });
}

export async function updateTask(
  db: PrismaClient,
  organizationId: string,
  id: string,
  data: {
    projectId?: string;
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: Date | null;
  }
) {
  const existing = await findTaskById(db, organizationId, id);

  if (!existing) {
    return null;
  }

  if (data.projectId) {
    const project = await db.project.findFirst({
      where: {
        id: data.projectId,
        organizationId
      }
    });

    if (!project) {
      return null;
    }
  }

  return db.task.update({
    where: { id },
    data
  });
}

export async function deleteTask(
  db: PrismaClient,
  organizationId: string,
  id: string
) {
  const existing = await findTaskById(db, organizationId, id);

  if (!existing) {
    return null;
  }

  return db.task.delete({
    where: { id }
  });
}
