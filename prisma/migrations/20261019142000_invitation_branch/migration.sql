-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN "branchId" TEXT,
ADD COLUMN "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
