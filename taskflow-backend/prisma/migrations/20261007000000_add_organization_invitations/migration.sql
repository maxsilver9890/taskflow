CREATE TABLE "organization_invitations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "inviterId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "org_member_role" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organization_invitations_tokenHash_key" ON "organization_invitations"("tokenHash");
CREATE INDEX "organization_invitations_organizationId_email_idx" ON "organization_invitations"("organizationId", "email");
CREATE INDEX "organization_invitations_expiresAt_idx" ON "organization_invitations"("expiresAt");
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
