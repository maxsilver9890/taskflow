import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma.js";
import {
  createProjectSchema,
  listProjectsSchema,
  projectIdSchema,
  updateProjectSchema
} from "./project.schemas.js";
import * as ProjectService from "./project.service.js";

function requireAuth(req: Request) {
  if (!req.auth) {
    throw new Error("Authentication context missing");
  }

  return req.auth;
}

export async function createProjectHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { body } = createProjectSchema.parse({
      body: req.body
    });

    const auth = requireAuth(req);

    // Spread to strip `undefined` optional fields so exactOptionalPropertyTypes
    // doesn't complain when passing Zod output to the service layer.
    const project = await ProjectService.createProject(prisma, auth.orgId, {
      name: body.name,
      ...(body.description !== undefined && { description: body.description })
    });

    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
}

export async function listProjectsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { query } = listProjectsSchema.parse({
      query: req.query
    });

    const auth = requireAuth(req);

    const result = await ProjectService.listProjects(
      prisma,
      auth.orgId,
      query.page,
      query.limit
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getProjectHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { params } = projectIdSchema.parse({
      params: req.params
    });

    const auth = requireAuth(req);

    const project = await ProjectService.getProject(
      prisma,
      auth.orgId,
      params.id
    );

    res.status(200).json(project);
  } catch (error) {
    next(error);
  }
}

export async function updateProjectHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { params, body } = updateProjectSchema.parse({
      params: req.params,
      body: req.body
    });

    const auth = requireAuth(req);

    const project = await ProjectService.updateProject(
      prisma,
      auth.orgId,
      params.id,
      body
    );

    res.status(200).json(project);
  } catch (error) {
    next(error);
  }
}

export async function deleteProjectHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { params } = projectIdSchema.parse({
      params: req.params
    });

    const auth = requireAuth(req);

    await ProjectService.deleteProject(prisma, auth.orgId, params.id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function dashboardHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { params } = projectIdSchema.parse({
      params: req.params
    });

    const auth = requireAuth(req);

    const dashboard = await ProjectService.getDashboard(
      prisma,
      auth.orgId,
      params.id
    );

    res.status(200).json(dashboard);
  } catch (error) {
    next(error);
  }
}
