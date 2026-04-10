ALTER TABLE "room_types"
ADD COLUMN "base_inventory" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "room_types"
ADD CONSTRAINT "room_types_base_inventory_min_check" CHECK ("base_inventory" >= 0);

CREATE TABLE "promotions" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "discount_percent" DOUBLE PRECISION NOT NULL,
  "season" TEXT,
  "property_ids" JSONB,
  "start_date" TIMESTAMP(3),
  "end_date" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "promotions_start_date_idx" ON "promotions"("start_date");
CREATE INDEX "promotions_end_date_idx" ON "promotions"("end_date");
