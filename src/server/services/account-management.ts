import { prisma } from "@/lib/prisma";

export async function getAccountImpact(userId: string, accountId: string) {
  const transactions = await prisma.transaction.count({
    where: { userId, accountId }
  });

  return { transactions };
}

export async function archiveAccount(userId: string, accountId: string, archived: boolean) {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw new Error("Account not found");

  return prisma.account.update({
    where: { id: accountId },
    data: { archivedAt: archived ? new Date() : null }
  });
}

export async function deleteAccountWithStrategy(input: {
  userId: string;
  accountId: string;
  strategy: "reassign" | "block";
  targetAccountId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({ where: { id: input.accountId, userId: input.userId } });
    if (!account) throw new Error("Account not found");

    const txCount = await tx.transaction.count({ where: { userId: input.userId, accountId: account.id } });

    if (txCount > 0 && input.strategy === "block") {
      throw new Error("Account has transactions. Reassign before deleting.");
    }

    if (txCount > 0 && input.strategy === "reassign") {
      if (!input.targetAccountId) throw new Error("targetAccountId is required for reassign strategy");

      const target = await tx.account.findFirst({
        where: { id: input.targetAccountId, userId: input.userId, archivedAt: null }
      });

      if (!target) throw new Error("Target account invalid or archived");

      await tx.transaction.updateMany({
        where: { userId: input.userId, accountId: account.id },
        data: { accountId: target.id }
      });
    }

    await tx.account.delete({ where: { id: account.id } });

    return { deletedAccountId: account.id };
  });
}
