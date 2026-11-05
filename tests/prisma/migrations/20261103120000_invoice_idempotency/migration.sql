-- Duplicate-submission protection for bills.
ALTER TABLE "Invoice" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "Invoice_salonId_idempotencyKey_key" ON "Invoice"("salonId", "idempotencyKey");
