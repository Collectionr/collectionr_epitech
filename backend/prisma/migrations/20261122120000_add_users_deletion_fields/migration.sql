-- AlterTable
ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMPTZ(6),
ADD COLUMN "isAnonymized" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- An anonymized account is one whose erasure was requested: it cannot skip the grace period.
ALTER TABLE "users" ADD CONSTRAINT "users_anonymized_requires_deleted_at"
  CHECK (NOT "isAnonymized" OR "deletedAt" IS NOT NULL);
