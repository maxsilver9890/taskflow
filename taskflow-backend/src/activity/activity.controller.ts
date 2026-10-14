import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma.js";
import { listCommentActivitySchema } from "./activity.schemas.js";
import * as ActivityService from "./activity.service.js";

export async function listCommentActivityHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.auth) throw new Error("Authentication context missing");
    const { query } = listCommentActivitySchema.parse({ query: req.query });
    const result = await ActivityService.listCommentActivity(
      prisma,
      req.auth.orgId,
      query.page,
      query.limit,
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
