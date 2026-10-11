import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import * as UserData from "../../src/users/user.data.js";
import { changePassword, getMe, listOrganizations, updateMe } from "../../src/users/user.service.js";

vi.mock("../../src/users/user.data.js", () => ({
  findUserProfile: vi.fn(),
  findUserForPasswordChange: vi.fn(),
  updateUserName: vi.fn(),
  updateUserPassword: vi.fn()
  ,findUserOrganizations: vi.fn()
}));

describe("user.service", () => {
  const db = {} as unknown as PrismaClient;
  const userId = "917ffeaf-f862-4411-82c3-b0f8629d0a0f";
  const organization = { id: "a0ab963b-d0ad-4f44-a160-11b5ca2dfa2f", name: "Northstar Labs" };
  const profile = {
    id: userId,
    name: "Ava Shah",
    email: "ava.shah@northstar.example",
    orgMemberships: [{ role: "ORG_ADMIN", organization }]
  };

  beforeEach(() => vi.clearAllMocks());

  it("returns the authenticated user's profile and organization role", async () => {
    vi.mocked(UserData.findUserProfile).mockResolvedValue(profile as never);
    await expect(getMe(db, userId)).resolves.toEqual({
      id: userId,
      name: "Ava Shah",
      email: "ava.shah@northstar.example",
      organization: { ...organization, role: "ORG_ADMIN" }
    });
  });

  it("updates only the user's name", async () => {
    vi.mocked(UserData.updateUserName).mockResolvedValue({ ...profile, name: "New Name" } as never);
    await expect(updateMe(db, userId, { name: "New Name" })).resolves.toMatchObject({ name: "New Name" });
    expect(UserData.updateUserName).toHaveBeenCalledWith(db, userId, "New Name");
  });

  it("lists every organization membership with its role", async () => {
    vi.mocked(UserData.findUserOrganizations).mockResolvedValue([
      { organization: { id: organization.id, name: organization.name }, role: "ORG_ADMIN" },
      { organization: { id: "b0ab963b-d0ad-4f44-a160-11b5ca2dfa2f", name: "Other Org" }, role: "MEMBER" }
    ] as never);

    await expect(listOrganizations(db, userId)).resolves.toEqual({
      data: [
        {
          id: organization.id,
          name: organization.name,
          organizationId: organization.id,
          organizationName: organization.name,
          role: "ORG_ADMIN"
        },
        {
          id: "b0ab963b-d0ad-4f44-a160-11b5ca2dfa2f",
          name: "Other Org",
          organizationId: "b0ab963b-d0ad-4f44-a160-11b5ca2dfa2f",
          organizationName: "Other Org",
          role: "MEMBER"
        }
      ],
      total: 2
    });
  });

  it("changes the password after verifying the current password", async () => {
    const hash = await bcrypt.hash("OldPassword123!", 12);
    vi.mocked(UserData.findUserForPasswordChange).mockResolvedValue({ passwordHash: hash });
    vi.mocked(UserData.updateUserPassword).mockResolvedValue({} as never);

    await expect(changePassword(db, userId, { currentPassword: "OldPassword123!", newPassword: "NewPassword123!" }))
      .resolves.toEqual({ message: "Password changed successfully." });

    const [, , newHash] = vi.mocked(UserData.updateUserPassword).mock.calls[0] ?? [];
    expect(typeof newHash).toBe("string");
    await expect(bcrypt.compare("NewPassword123!", newHash as string)).resolves.toBe(true);
  });

  it("rejects an incorrect current password", async () => {
    vi.mocked(UserData.findUserForPasswordChange).mockResolvedValue({ passwordHash: await bcrypt.hash("correct", 12) });
    await expect(changePassword(db, userId, { currentPassword: "wrong", newPassword: "NewPassword123!" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS"
    });
    expect(UserData.updateUserPassword).not.toHaveBeenCalled();
  });
});
