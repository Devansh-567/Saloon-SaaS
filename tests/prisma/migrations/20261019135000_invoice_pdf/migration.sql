-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "pdfFileId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_pdfFileId_key" ON "Invoice"("pdfFileId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_pdfFileId_fkey" FOREIGN KEY ("pdfFileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
