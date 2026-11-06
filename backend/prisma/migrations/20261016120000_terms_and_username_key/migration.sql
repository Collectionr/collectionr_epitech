-- Terms of service: keep the instant of acceptance and the version that was accepted.
ALTER TABLE "users" RENAME COLUMN "consentGivenAt" TO "termsAcceptedAt";
ALTER TABLE "users" ADD COLUMN "termsVersion" TEXT NOT NULL DEFAULT '1';
ALTER TABLE "users" ALTER COLUMN "termsVersion" DROP DEFAULT;

-- Canonical username key (User.usernameKey): NFKC, trimmed, lower case, runs of whitespace collapsed.
-- Backfilled from the existing rows; the TypeScript User.usernameKey stays the reference.
ALTER TABLE "users" ADD COLUMN "usernameKey" TEXT;
UPDATE "users"
   SET "usernameKey" = regexp_replace(
         regexp_replace(lower(normalize("username", NFKC)), '^\s+|\s+$', '', 'g'),
         '\s+', ' ', 'g');

-- Refuse to build the unique index over existing duplicates, and say which ones.
DO $$
DECLARE
  duplicates TEXT;
BEGIN
  SELECT string_agg(format('"%s" (%s accounts)', "usernameKey", n), ', ')
    INTO duplicates
    FROM (SELECT "usernameKey", count(*) AS n FROM "users" GROUP BY "usernameKey" HAVING count(*) > 1) d;
  IF duplicates IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot enforce unique usernames: duplicate keys already exist: %', duplicates;
  END IF;
END $$;

ALTER TABLE "users" ALTER COLUMN "usernameKey" SET NOT NULL;
CREATE UNIQUE INDEX "users_usernameKey_key" ON "users"("usernameKey");
