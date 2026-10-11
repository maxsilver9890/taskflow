import type { PrismaClient } from "@prisma/client";

import type { UpdateProjectBody } from "./project.schemas.js";

export async function createProject(
  db: PrismaClient,
  organizationId: string,
  data: {
    name: string;
    description?: string;
  }
) {
  return db.project.create({
    data: {
      organizationId,
      name: data.name,
      // Prisma expects string | null, not string | undefined
      ...(data.description !== undefined && { description: data.description })
    }
  });
}

export async function findProjects(
  db: PrismaClient,
  organizationId: string,
  skip: number,
  take: number
) {
  const [data, total] = await db.$transaction([
    db.project.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),
    db.project.count({
      where: { organizationId }
    })
  ]);

  return { data, total };
}

export async function findProjectById(
  db: PrismaClient,
  organizationId: string,
  id: string
) {
  return db.project.findFirst({
    where: {
      id,
      organizationId
    }
  });
}

export async function findProjectByIdOnly(
  db: PrismaClient,
  id: string
) {
  return db.project.findUnique({
    where: { id }
  });
}

export async function updateProject(
  db: PrismaClient,
  organizationId: string,
  id: string,
  data: UpdateProjectBody
) {
  const project = await findProjectById(db, organizationId, id);

  if (!project) {
    return null;
  }

  const updateData: {
    name?: string;
    description?: string | null;
  } = {};

  if (data.name !== undefined) {
    updateData.name = data.name;
  }

  if (data.description !== undefined) {
    updateData.description = data.description;
  }

  return db.project.update({
    where: { id },
    data: updateData
  });
}

export async function deleteProject(
  db: PrismaClient,
  organizationId: string,
  id: string
) {
  const project = await findProjectById(db, organizationId, id);

  if (!project) {
    return null;
  }

  return db.project.delete({
    where: { id }
  });
}

export async function getProjectDashboard(
  db: PrismaClient,
  organizationId: string,
  projectId: string
) {
  const project = await findProjectById(db, organizationId, projectId);

  if (!project) {
    return null;
  }

  const grouped = await db.task.groupBy({
    by: ["status"],
    where: {
      projectId
    },
    _count: {
      _all: true
    }
  });

  return {
    projectId,
    counts: {
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0
    },
    grouped
  };
}
