import { prisma } from "@/lib/prisma";

export async function softDeleteTransaction(userId: string, transactionId: string) {
  const updated = await prisma.transaction.updateMany({
    where: { id: transactionId, userId, deletedAt: null },
    data: { deletedAt: new Date() }
  });

  if (updated.count === 0) {
    throw new Error("Transaction not found or already deleted");
  }

  return { updated: updated.count };
}

export async function restoreTransaction(userId: string, transactionId: string) {
  const updated = await prisma.transaction.updateMany({
    where: { id: transactionId, userId },
    data: { deletedAt: null }
  });

  if (updated.count === 0) {
    throw new Error("Transaction not found");
  }

  return { updated: updated.count };
}
