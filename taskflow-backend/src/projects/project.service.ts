import type { PrismaClient } from "@prisma/client";
import type { UpdateProjectBody } from "./project.schemas.js";

import * as ProjectData from "./project.data.js";
import { AppError } from "../lib/errors.js";
export async function createProject(
  db: PrismaClient,
  organizationId: string,
  data: {
    name: string;
    description?: string;
  }
) {
  return ProjectData.createProject(db, organizationId, data);
}

export async function listProjects(
  db: PrismaClient,
  organizationId: string,
  page: number,
  limit: number
) {
  const skip = (page - 1) * limit;

  const result = await ProjectData.findProjects(
    db,
    organizationId,
    skip,
    limit
  );

  return {
    data: result.data,
    total: result.total,
    page,
    limit
  };
}

export async function getProject(
  db: PrismaClient,
  organizationId: string,
  id: string
) {
  const project = await ProjectData.findProjectByIdOnly(db, id);

  if (!project) {
    throw new AppError(
      404,
      "PROJECT_NOT_FOUND",
      "Project not found"
    );
  }

  if (project.organizationId !== organizationId) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Forbidden"
    );
  }

  return project;
}

export async function updateProject(
  db: PrismaClient,
  organizationId: string,
  id: string,
  data: UpdateProjectBody
) {
  const project = await ProjectData.updateProject(
    db,
    organizationId,
    id,
    data
  );

  if (!project) {
    throw new AppError(
      404,
      "PROJECT_NOT_FOUND",
      "Project not found"
    );
  }

  return project;
}

export async function deleteProject(
  db: PrismaClient,
  organizationId: string,
  id: string
) {
  const project = await ProjectData.deleteProject(
    db,
    organizationId,
    id
  );

  if (!project) {
    throw new AppError(
      404,
      "PROJECT_NOT_FOUND",
      "Project not found"
    );
  }
}

export async function getDashboard(
  db: PrismaClient,
  organizationId: string,
  id: string
) {
  const dashboard = await ProjectData.getProjectDashboard(
    db,
    organizationId,
    id
  );

  if (!dashboard) {
    throw new AppError(
      404,
      "PROJECT_NOT_FOUND",
      "Project not found"
    );
  }

  const counts = {
    todo: 0,
    in_progress: 0,
    review: 0,
    done: 0
  };

  for (const item of dashboard.grouped) {
    counts[item.status.toLowerCase() as keyof typeof counts] =
      item._count._all;
  }

  return {
    projectId: id,
    counts
  };
}