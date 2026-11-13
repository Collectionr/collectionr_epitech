-- A user cannot own two collections with the same name (two users can). The collections feature is
-- recent, but a database may already hold duplicates: keep the oldest of each group as it is and
-- suffix the others (" (2)", " (3)"...), so the unique index below can be created instead of
-- failing the migration. Nothing is deleted. A suffixed name can exceed the 60 characters the domain
-- accepts on creation: that is harmless, stored names are never re-validated.
UPDATE "collections" AS c
SET "name" = c."name" || ' (' || ranked.position || ')'
FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId", "name" ORDER BY "createdAt", "id") AS position
    FROM "collections"
) AS ranked
WHERE c."id" = ranked."id" AND ranked.position > 1;

-- CreateIndex
CREATE UNIQUE INDEX "collections_userId_name_key" ON "collections"("userId", "name");
