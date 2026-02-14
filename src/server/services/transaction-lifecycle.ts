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

export async function hardDeleteTransaction(userId: string, transactionId: string) {
  const existing = await prisma.transaction.findFirst({
    where: { id: transactionId, userId }
  });

  if (!existing) {
    throw new Error("Transaction not found");
  }

  if (!existing.deletedAt) {
    throw new Error("Only deleted transactions can be permanently removed");
  }

  await prisma.$transaction(async (tx) => {
    await tx.importedTransaction.updateMany({
      where: { transactionId },
      data: { transactionId: null }
    });

    await tx.transaction.delete({
      where: { id: transactionId }
    });
  });

  return { deleted: 1 };
}

export async function purgeDeletedTransactions(
  userId: string,
  input:
    | { mode: "all_deleted" }
    | { mode: "selected"; ids: string[] }
    | { mode: "older_than"; before: Date }
) {
  const where =
    input.mode === "all_deleted"
      ? { userId, deletedAt: { not: null as Date | null } }
      : input.mode === "selected"
        ? { userId, deletedAt: { not: null as Date | null }, id: { in: input.ids } }
        : { userId, deletedAt: { not: null as Date | null, lt: input.before } };

  const rows = await prisma.transaction.findMany({
    where,
    select: { id: true }
  });

  if (rows.length === 0) {
    return { matchedCount: 0, deletedCount: 0 };
  }

  const ids = rows.map((row) => row.id);

  await prisma.$transaction(async (tx) => {
    await tx.importedTransaction.updateMany({
      where: { transactionId: { in: ids } },
      data: { transactionId: null }
    });
    await tx.transaction.deleteMany({
      where: { id: { in: ids }, userId, deletedAt: { not: null } }
    });
  });

  return { matchedCount: ids.length, deletedCount: ids.length };
}
