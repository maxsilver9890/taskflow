-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- Backfill: accounts created before this migration predate OTP verification
-- entirely, so there is no code they could ever have confirmed. Treat them as
-- already verified (stamped with their original createdAt) rather than
-- retroactively locking out every existing user the next time they sign in.
-- Only rows inserted AFTER this migration get the real `false` default above.
UPDATE "users" SET "emailVerified" = true, "emailVerifiedAt" = "createdAt" WHERE "emailVerified" = false;

-- CreateTable
CREATE TABLE "email_verification_otps" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verification_otps_userId_idx" ON "email_verification_otps"("userId");

-- CreateIndex
CREATE INDEX "email_verification_otps_expiresAt_idx" ON "email_verification_otps"("expiresAt");

-- AddForeignKey
ALTER TABLE "email_verification_otps" ADD CONSTRAINT "email_verification_otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
