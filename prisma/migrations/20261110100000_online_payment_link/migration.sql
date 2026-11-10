-- Razorpay payment link remembered on the bill so the same link is reused.
ALTER TABLE "Invoice" ADD COLUMN "onlineLinkId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "onlineLinkUrl" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "onlineLinkAmount" DECIMAL(12,2);
