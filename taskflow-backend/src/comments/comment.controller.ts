import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma.js";
import {
  commentIdSchema,
  createCommentSchema,
  listCommentsSchema,
  updateCommentSchema
} from "./comment.schemas.js";
import * as CommentService from "./comment.service.js";

function requireAuth(req: Request) {
  if (!req.auth) {
    throw new Error("Authentication context missing");
  }

  return req.auth;
}

export async function createCommentHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { params, body } = createCommentSchema.parse({
      params: req.params,
      body: req.body
    });

    const auth = requireAuth(req);

    const comment = await CommentService.addComment(
      prisma,
      auth.orgId,
      params.taskId,
      auth.userId,
      body.content
    );

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
}

export async function listCommentsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { params, query } = listCommentsSchema.parse({
      params: req.params,
      query: req.query
    });

    const auth = requireAuth(req);

    const result = await CommentService.listComments(
      prisma,
      auth.orgId,
      params.taskId,
      query.page,
      query.limit
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateCommentHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { params, body } = updateCommentSchema.parse({
      params: req.params,
      body: req.body
    });

    const auth = requireAuth(req);

    const comment = await CommentService.editComment(
      prisma,
      auth.orgId,
      params.taskId,
      params.commentId,
      auth.userId,
      body.content
    );

    res.status(200).json(comment);
  } catch (error) {
    next(error);
  }
}

export async function deleteCommentHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { params } = commentIdSchema.parse({
      params: req.params
    });

    const auth = requireAuth(req);

    await CommentService.removeComment(
      prisma,
      auth.orgId,
      params.taskId,
      params.commentId,
      auth.userId,
      auth.role
    );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
