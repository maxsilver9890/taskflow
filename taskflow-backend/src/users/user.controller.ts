import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma.js";
import * as UserService from "./user.service.js";
import { changePasswordSchema, updateMeSchema } from "./user.schemas.js";

function requireUserId(req: Request) {
  if (!req.auth) throw new Error("Authentication context missing");
  return req.auth.userId;
}

export async function getMeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw new Error("Authentication context missing");
    res.status(200).json(await UserService.getMe(prisma, req.auth.userId, req.auth.orgId));
  } catch (error) {
    next(error);
  }
}

export async function listMyOrganizationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await UserService.listOrganizations(prisma, requireUserId(req)));
  } catch (error) {
    next(error);
  }
}

export async function updateMeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { body } = updateMeSchema.parse({ body: req.body });
    res.status(200).json(await UserService.updateMe(prisma, requireUserId(req), body));
  } catch (error) {
    next(error);
  }
}

export async function changePasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { body } = changePasswordSchema.parse({ body: req.body });
    res.status(200).json(await UserService.changePassword(prisma, requireUserId(req), body));
  } catch (error) {
    next(error);
  }
}
