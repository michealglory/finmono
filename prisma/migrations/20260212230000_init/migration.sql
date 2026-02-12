-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "FileType" AS ENUM ('CSV', 'XLSX', 'PDF', 'IMAGE', 'TEXT');
CREATE TYPE "JobType" AS ENUM ('STATEMENT_IMPORT', 'RECEIPT_IMPORT');
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'NEEDS_REVIEW', 'FAILED', 'COMPLETED');

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "baseCurrency" TEXT NOT NULL DEFAULT 'NGN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Account" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "institution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "parentId" TEXT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClassificationRule" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "keyword" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassificationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "categoryId" TEXT,
  "direction" "Direction" NOT NULL,
  "description" TEXT NOT NULL,
  "merchantName" TEXT,
  "amountOriginal" DECIMAL(14,2) NOT NULL,
  "originalCurrency" TEXT NOT NULL,
  "amountBase" DECIMAL(14,2) NOT NULL,
  "baseCurrency" TEXT NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "sourceHash" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransactionLineItem" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "categoryId" TEXT,
  "itemTag" TEXT,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(10,2),
  "unitPrice" DECIMAL(12,2),
  "amountOriginal" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FXRate" (
  "id" TEXT NOT NULL,
  "baseCurrency" TEXT NOT NULL,
  "quoteCurrency" TEXT NOT NULL,
  "rate" DECIMAL(18,8) NOT NULL,
  "rateDate" TIMESTAMP(3) NOT NULL,
  "provider" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FXRate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UploadedFile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "fileType" "FileType" NOT NULL,
  "rawText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "uploadedFileId" TEXT,
  "type" "JobType" NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
  "errorSummary" TEXT,
  "outputJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportedTransaction" (
  "id" TEXT NOT NULL,
  "importJobId" TEXT NOT NULL,
  "transactionId" TEXT,
  "dedupeHash" TEXT NOT NULL,
  "rawPayload" JSONB NOT NULL,
  "proposedCategoryId" TEXT,
  "confidence" DECIMAL(5,2),
  "duplicateOfId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportedTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIAudit" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "importJobId" TEXT,
  "model" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "responseJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIAudit_pkey" PRIMARY KEY ("id")
);

-- Indexes/Constraints
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Account_userId_name_key" ON "Account"("userId", "name");
CREATE UNIQUE INDEX "Category_userId_slug_key" ON "Category"("userId", "slug");
CREATE UNIQUE INDEX "FXRate_baseCurrency_quoteCurrency_rateDate_key" ON "FXRate"("baseCurrency", "quoteCurrency", "rateDate");
CREATE INDEX "Category_userId_level_idx" ON "Category"("userId", "level");
CREATE INDEX "ClassificationRule_userId_priority_idx" ON "ClassificationRule"("userId", "priority");
CREATE INDEX "Transaction_userId_transactionDate_idx" ON "Transaction"("userId", "transactionDate");
CREATE INDEX "Transaction_accountId_transactionDate_idx" ON "Transaction"("accountId", "transactionDate");
CREATE INDEX "Transaction_userId_sourceHash_idx" ON "Transaction"("userId", "sourceHash");
CREATE INDEX "TransactionLineItem_transactionId_idx" ON "TransactionLineItem"("transactionId");
CREATE INDEX "FXRate_rateDate_idx" ON "FXRate"("rateDate");
CREATE INDEX "UploadedFile_userId_createdAt_idx" ON "UploadedFile"("userId", "createdAt");
CREATE INDEX "ImportJob_userId_status_idx" ON "ImportJob"("userId", "status");
CREATE INDEX "ImportedTransaction_importJobId_idx" ON "ImportedTransaction"("importJobId");
CREATE INDEX "ImportedTransaction_dedupeHash_idx" ON "ImportedTransaction"("dedupeHash");
CREATE INDEX "AIAudit_userId_createdAt_idx" ON "AIAudit"("userId", "createdAt");

-- Foreign Keys
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassificationRule" ADD CONSTRAINT "ClassificationRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassificationRule" ADD CONSTRAINT "ClassificationRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransactionLineItem" ADD CONSTRAINT "TransactionLineItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionLineItem" ADD CONSTRAINT "TransactionLineItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_uploadedFileId_fkey" FOREIGN KEY ("uploadedFileId") REFERENCES "UploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImportedTransaction" ADD CONSTRAINT "ImportedTransaction_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportedTransaction" ADD CONSTRAINT "ImportedTransaction_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIAudit" ADD CONSTRAINT "AIAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
