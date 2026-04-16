-- Add base price at rate-plan level for meal-plan driven pricing initialization.
ALTER TABLE "rate_plans"
ADD COLUMN "base_price" DOUBLE PRECISION NOT NULL DEFAULT 0;
