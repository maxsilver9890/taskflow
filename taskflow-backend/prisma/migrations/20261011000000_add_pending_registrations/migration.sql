CREATE TABLE "pending_registrations" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "otpExpiresAt" TIMESTAMP(3) NOT NULL,
    "otpCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pending_registrations_email_key" ON "pending_registrations"("email");
CREATE INDEX "pending_registrations_otpExpiresAt_idx" ON "pending_registrations"("otpExpiresAt");
