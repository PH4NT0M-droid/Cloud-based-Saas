ALTER TABLE "room_types"
ADD COLUMN "base_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "extra_person_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "base_capacity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "max_capacity" INTEGER NOT NULL DEFAULT 1;

UPDATE "room_types"
SET "base_capacity" = GREATEST(COALESCE("maxOccupancy", 1), 1),
    "max_capacity" = GREATEST(COALESCE("maxOccupancy", 1), 1)
WHERE "base_capacity" = 1
  AND "max_capacity" = 1;

ALTER TABLE "bookings"
ADD COLUMN "guests_count" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "room_types"
ADD CONSTRAINT "room_types_capacity_check" CHECK ("max_capacity" >= "base_capacity"),
ADD CONSTRAINT "room_types_base_capacity_min_check" CHECK ("base_capacity" >= 1),
ADD CONSTRAINT "room_types_extra_person_price_min_check" CHECK ("extra_person_price" >= 0),
ADD CONSTRAINT "room_types_base_price_min_check" CHECK ("base_price" >= 0);
