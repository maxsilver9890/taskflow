import bcrypt from "bcrypt";
import type { PrismaClient } from "@prisma/client";

import { env } from "../config/env.js";
import { AppError, AuthErrors } from "../lib/errors.js";
import * as UserData from "./user.data.js";
import type { ChangePasswordBody, UpdateMeBody } from "./user.schemas.js";

type ProfileUser = {
  id: string;
  name: string;
  email: string;
  orgMemberships: Array<{
    role: string;
    organization: { id: string; name: string };
  }>;
};

function toProfile(user: ProfileUser) {
  const membership = user.orgMemberships[0];
  if (!membership) {
    throw new AppError(403, "ORGANIZATION_REQUIRED", "Your account is not assigned to an organization.");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      role: membership.role
    }
  };
}

export async function getMe(db: PrismaClient, userId: string, organizationId?: string) {
  const user = await UserData.findUserProfile(db, userId, organizationId);
  if (!user) throw AuthErrors.TOKEN_INVALID();
  return toProfile(user);
}

export async function listOrganizations(db: PrismaClient, userId: string) {
  const organizations = await UserData.findUserOrganizations(db, userId);
  const data = organizations.map(({ organization, role }) => ({
    id: organization.id,
    name: organization.name,
    organizationId: organization.id,
    organizationName: organization.name,
    role
  }));
  return { data, total: data.length };
}

export async function updateMe(db: PrismaClient, userId: string, body: UpdateMeBody) {
  return toProfile(await UserData.updateUserName(db, userId, body.name));
}

export async function changePassword(db: PrismaClient, userId: string, body: ChangePasswordBody) {
  const user = await UserData.findUserForPasswordChange(db, userId);
  if (!user) throw AuthErrors.TOKEN_INVALID();

  if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
    throw AuthErrors.INVALID_CREDENTIALS();
  }

  const rounds = Math.max(env.bcryptRounds, 12);
  const passwordHash = await bcrypt.hash(body.newPassword, rounds);
  await UserData.updateUserPassword(db, userId, passwordHash);
  return { message: "Password changed successfully." };
}
