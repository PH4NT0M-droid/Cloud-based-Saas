-- Create many-to-many mapping table between managers and properties.
CREATE TABLE "property_managers" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "property_managers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "property_managers_userId_propertyId_key" ON "property_managers"("userId", "propertyId");
CREATE INDEX "property_managers_userId_idx" ON "property_managers"("userId");
CREATE INDEX "property_managers_propertyId_idx" ON "property_managers"("propertyId");

ALTER TABLE "property_managers"
  ADD CONSTRAINT "property_managers_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "property_managers"
  ADD CONSTRAINT "property_managers_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing single-manager assignments into join table.
INSERT INTO "property_managers" ("id", "userId", "propertyId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || "id"), "managerId", "id", CURRENT_TIMESTAMP
FROM "properties"
WHERE "managerId" IS NOT NULL
ON CONFLICT ("userId", "propertyId") DO NOTHING;

-- Remove old one-to-many assignment model.
ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_managerId_fkey";
DROP INDEX IF EXISTS "properties_managerId_idx";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "managerId";
