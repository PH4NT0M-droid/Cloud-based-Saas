ALTER TABLE "bookings"
ADD COLUMN "guestPincode" TEXT;

ALTER TABLE "bookings"
ADD COLUMN "includeGstInvoice" BOOLEAN NOT NULL DEFAULT true;
