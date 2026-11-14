DROP INDEX IF EXISTS "Customer_salonId_phone_key";
CREATE UNIQUE INDEX "Customer_salonId_phone_key" ON "Customer"("salonId", "phone") WHERE "phone" <> '';
