-- Category archive/system fields
ALTER TABLE "Category" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Category" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Category_userId_archivedAt_idx" ON "Category"("userId", "archivedAt");
ALTER TABLE "Category" DROP CONSTRAINT "Category_parentId_fkey";
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tag model
CREATE TABLE "Tag" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");
CREATE INDEX "Tag_userId_archivedAt_idx" ON "Tag"("userId", "archivedAt");

CREATE TABLE "TransactionTag" (
  "transactionId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionTag_pkey" PRIMARY KEY ("transactionId", "tagId")
);

CREATE INDEX "TransactionTag_tagId_idx" ON "TransactionTag"("tagId");

CREATE TABLE "LineItemTag" (
  "lineItemId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LineItemTag_pkey" PRIMARY KEY ("lineItemId", "tagId")
);

CREATE INDEX "LineItemTag_tagId_idx" ON "LineItemTag"("tagId");

ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionTag" ADD CONSTRAINT "TransactionTag_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionTag" ADD CONSTRAINT "TransactionTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LineItemTag" ADD CONSTRAINT "LineItemTag_lineItemId_fkey" FOREIGN KEY ("lineItemId") REFERENCES "TransactionLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LineItemTag" ADD CONSTRAINT "LineItemTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
