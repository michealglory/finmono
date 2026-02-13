ALTER TABLE "Account" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Account_userId_archivedAt_idx" ON "Account"("userId", "archivedAt");

ALTER TABLE "Transaction" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "Transaction_userId_deletedAt_idx" ON "Transaction"("userId", "deletedAt");
