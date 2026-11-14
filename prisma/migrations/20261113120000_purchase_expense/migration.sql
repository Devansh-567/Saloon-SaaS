ALTER TABLE "Expense" ADD COLUMN "purchaseId" TEXT;
CREATE UNIQUE INDEX "Expense_purchaseId_key" ON "Expense"("purchaseId");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
