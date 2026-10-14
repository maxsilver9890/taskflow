import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import * as OrganizationData from "../../src/organizations/organization.data.js";
import {
  getOrganization,
  listOrganizationMembers,
  changeMemberRole,
  removeMember
} from "../../src/organizations/organization.service.js";

vi.mock("../../src/organizations/organization.data.js", () => ({
  findOrganizationById: vi.fn(),
  countOrganizationMembers: vi.fn(),
  findOrganizationMembers: vi.fn(),
  findMember: vi.fn(),
  updateMemberRole: vi.fn(),
  deleteMember: vi.fn()
}));

describe("organization.service", () => {
  const db = {
    orgMember: { count: vi.fn() },
    $transaction: vi.fn()
  } as unknown as PrismaClient;

  const organizationId = "a0ab963b-d0ad-4f44-a160-11b5ca2dfa2f";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.orgMember.count).mockResolvedValue(2);
  });

  describe("getOrganization", () => {
    it("throws ORGANIZATION_NOT_FOUND when the org doesn't exist", async () => {
      vi.mocked(OrganizationData.findOrganizationById).mockResolvedValue(null);

      await expect(getOrganization(db, organizationId)).rejects.toMatchObject({
        statusCode: 404,
        code: "ORGANIZATION_NOT_FOUND"
      });

      expect(OrganizationData.countOrganizationMembers).not.toHaveBeenCalled();
    });

    it("returns the organization with a derived member count", async () => {
      const createdAt = new Date("2026-01-01T00:00:00.000Z");

      vi.mocked(OrganizationData.findOrganizationById).mockResolvedValue({
        id: organizationId,
        name: "Northstar Labs",
        createdAt,
        updatedAt: createdAt
      } as unknown as Awaited<ReturnType<typeof OrganizationData.findOrganizationById>>);

      vi.mocked(OrganizationData.countOrganizationMembers).mockResolvedValue(3);

      const result = await getOrganization(db, organizationId);

      expect(result).toEqual({
        id: organizationId,
        name: "Northstar Labs",
        createdAt,
        memberCount: 3
      });

      expect(OrganizationData.countOrganizationMembers).toHaveBeenCalledWith(
        db,
        organizationId
      );
    });
  });

  describe("listOrganizationMembers", () => {
    it("maps member rows to a flat, client-friendly shape", async () => {
      const joinedAt = new Date("2026-02-01T00:00:00.000Z");

      vi.mocked(OrganizationData.findOrganizationMembers).mockResolvedValue([
        {
          organizationId,
          userId: "917ffeaf-f862-4411-82c3-b0f8629d0a0f",
          role: "ORG_ADMIN",
          createdAt: joinedAt,
          user: {
            id: "917ffeaf-f862-4411-82c3-b0f8629d0a0f",
            name: "Ava Shah",
            email: "ava.shah@northstar.example"
          }
        }
      ] as unknown as Awaited<ReturnType<typeof OrganizationData.findOrganizationMembers>>);

      const result = await listOrganizationMembers(db, organizationId);

      expect(result).toEqual({
        data: [
          {
            userId: "917ffeaf-f862-4411-82c3-b0f8629d0a0f",
            name: "Ava Shah",
            email: "ava.shah@northstar.example",
            role: "ORG_ADMIN",
            joinedAt
          }
        ],
        total: 1
      });

    });

    it("returns an empty list when the org has no members", async () => {
      vi.mocked(OrganizationData.findOrganizationMembers).mockResolvedValue(
        [] as unknown as Awaited<ReturnType<typeof OrganizationData.findOrganizationMembers>>
      );

      const result = await listOrganizationMembers(db, organizationId);

      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  describe("member administration", () => {
    const actorId = "917ffeaf-f862-4411-82c3-b0f8629d0a0f";
    const targetId = "817ffeaf-f862-4411-82c3-b0f8629d0a0f";

    it("allows an admin to change a member role within the active organization", async () => {
      vi.mocked(OrganizationData.findMember)
        .mockResolvedValueOnce({ role: "ORG_ADMIN" } as never)
        .mockResolvedValueOnce({ role: "MEMBER" } as never);
      vi.mocked(OrganizationData.updateMemberRole).mockResolvedValue({
        organizationId, userId: targetId, role: "ORG_ADMIN", createdAt: new Date()
      } as never);

      await expect(changeMemberRole(
        db, organizationId, actorId, "MEMBER", targetId, "ORG_ADMIN"
      )).resolves.toMatchObject({ userId: targetId, role: "ORG_ADMIN" });
    });

    it("rejects role changes by a member", async () => {
      vi.mocked(OrganizationData.findMember).mockResolvedValue({ role: "MEMBER" } as never);
      await expect(changeMemberRole(
        db, organizationId, actorId, "MEMBER", targetId, "ORG_ADMIN"
      )).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("prevents self-removal and demoting the last admin", async () => {
      vi.mocked(OrganizationData.findMember).mockResolvedValue({ role: "ORG_ADMIN" } as never);
      await expect(removeMember(db, organizationId, actorId, "ORG_ADMIN", actorId))
        .rejects.toMatchObject({ code: "CANNOT_REMOVE_SELF" });
      vi.mocked(OrganizationData.findMember)
        .mockResolvedValueOnce({ role: "ORG_ADMIN" } as never)
        .mockResolvedValueOnce({ role: "ORG_ADMIN" } as never);
      vi.mocked(db.orgMember.count).mockResolvedValue(1);
      await expect(changeMemberRole(
        db, organizationId, actorId, "ORG_ADMIN", targetId, "MEMBER"
      )).rejects.toMatchObject({ code: "LAST_ADMIN" });
    });

    it("notifies a member after removing them from the organization", async () => {
      const transaction = {
        orgMember: { delete: vi.fn().mockResolvedValue({}) },
        notification: { create: vi.fn().mockResolvedValue({}) },
      };
      vi.mocked(db.$transaction).mockImplementation(async (callback) => callback(transaction as never));
      vi.mocked(OrganizationData.findMember)
        .mockResolvedValueOnce({ role: "ORG_ADMIN" } as never)
        .mockResolvedValueOnce({ role: "MEMBER" } as never);
      vi.mocked(OrganizationData.findOrganizationById).mockResolvedValue({ name: "Northstar Labs" } as never);

      await removeMember(db, organizationId, actorId, "ORG_ADMIN", targetId);

      expect(transaction.notification.create).toHaveBeenCalledWith({
        data: {
          userId: targetId,
          organizationId,
          organizationName: "Northstar Labs",
          title: "Removed from organization",
          message: 'You have been removed from "Northstar Labs" org.',
          link: null,
        },
      });
    });
  });
});
