-- Copyright (c) 2026 Devansh Singh
-- All Rights Reserved.
--
-- This software and its source code are proprietary
-- and confidential property of Guru AI Technologies.
--
-- Unauthorized copying, modification, distribution,
-- or use of this software, in whole or in part,
-- is strictly prohibited without prior written
-- permission from Guru AI Technologies.
--
-- Copyright (c) 2026 Devansh Singh
-- All Rights Reserved.
--
-- This software and its source code are proprietary
-- and confidential property of Guru AI Technologies.
--
-- Unauthorized copying, modification, distribution,
-- or use of this software, in whole or in part,
-- is strictly prohibited without prior written
-- permission from Guru AI Technologies.
--
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "pdfFileId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_pdfFileId_key" ON "Invoice"("pdfFileId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_pdfFileId_fkey" FOREIGN KEY ("pdfFileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
