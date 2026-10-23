-- Reference roles, inserted by the migration so every environment has them (production included):
-- the seed does not run there, and no account can be created without a role. Idempotent by name.
INSERT INTO "roles" ("id", "name")
VALUES (gen_random_uuid(), 'USER'), (gen_random_uuid(), 'ADMIN')
ON CONFLICT ("name") DO NOTHING;

-- users.role (enum) becomes users.roleId (foreign key to roles, ADR-013).
ALTER TABLE "users" ADD COLUMN "roleId" UUID;

UPDATE "users" AS u
   SET "roleId" = r."id"
  FROM "roles" AS r
 WHERE r."name" = u."role"::text;

ALTER TABLE "users" ALTER COLUMN "roleId" SET NOT NULL;

-- A role that still has accounts cannot be deleted.
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "users_roleId_idx" ON "users"("roleId");

ALTER TABLE "users" DROP COLUMN "role";
DROP TYPE "UserRole";
