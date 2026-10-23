-- users: optimistic lock
ALTER TABLE "users" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- sessions: token family, replay detection, absolute lifetime.
-- Added nullable, backfilled so existing sessions stay valid (each is its own family and
-- may not outlive its current expiry), then made NOT NULL.
ALTER TABLE "sessions"
  ADD COLUMN "familyId" UUID,
  ADD COLUMN "rotatedAt" TIMESTAMPTZ(6),
  ADD COLUMN "absoluteExpiresAt" TIMESTAMPTZ(6);

UPDATE "sessions" SET "familyId" = "id", "absoluteExpiresAt" = "expiresAt";

ALTER TABLE "sessions"
  ALTER COLUMN "familyId" SET NOT NULL,
  ALTER COLUMN "absoluteExpiresAt" SET NOT NULL;

CREATE INDEX "sessions_familyId_idx" ON "sessions"("familyId");

-- GDPR (S04): the audit trail keeps its entries after an account deletion (ON DELETE SET NULL),
-- but the email the entries carry in `metadata` is personal data of the deleted user. Not
-- modelled by Prisma, enforced here so it holds whatever code deletes the row.
CREATE FUNCTION purge_audit_pii_on_user_delete() RETURNS trigger AS $$
BEGIN
  UPDATE "audit_logs"
     SET "metadata" = "metadata" - 'email'
   WHERE "userId" = OLD."id" AND "metadata" ? 'email';
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_purge_audit_pii
  BEFORE DELETE ON "users"
  FOR EACH ROW EXECUTE FUNCTION purge_audit_pii_on_user_delete();
