-- Alter enum to the new role set.
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'MANAGER', 'STAFF');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users"
  ALTER COLUMN "role"
  TYPE "UserRole_new"
  USING (
    CASE
      WHEN "role"::text = 'OWNER' THEN 'MANAGER'
      ELSE "role"::text
    END
  )::"UserRole_new";
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'MANAGER';
COMMIT;

-- Preserve existing ownership assignments by renaming ownerId -> managerId.
ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_ownerId_fkey";
DROP INDEX IF EXISTS "properties_ownerId_idx";
ALTER TABLE "properties" RENAME COLUMN "ownerId" TO "managerId";

-- Add manager permission payload support.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions" JSONB;
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'MANAGER';

CREATE INDEX IF NOT EXISTS "properties_managerId_idx" ON "properties"("managerId");
ALTER TABLE "properties"
  ADD CONSTRAINT "properties_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
