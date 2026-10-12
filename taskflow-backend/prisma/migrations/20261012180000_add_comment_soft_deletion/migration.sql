ALTER TABLE "comments"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedByName" TEXT;
