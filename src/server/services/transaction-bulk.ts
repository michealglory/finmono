import { Direction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildTransactionWhere, type TransactionFilterInput } from "@/server/services/transaction-filters";

type BulkAction = "assign_category" | "clear_category" | "soft_delete" | "restore" | "permanent_delete";

type Selection =
  | {
      mode: "explicit_ids";
      ids: string[];
    }
  | {
      mode: "all_filtered";
      filters?: TransactionFilterInput;
    };

type BulkInput = {
  userId: string;
  action: BulkAction;
  selection: Selection;
  data?: {
    categoryId?: string | null;
  };
};

function baseWhereForSelection(userId: string, selection: Selection): Prisma.TransactionWhereInput {
  if (selection.mode === "explicit_ids") {
    const ids = Array.from(new Set(selection.ids.filter(Boolean)));
    if (ids.length === 0) throw new Error("No transactions selected");
    return { userId, id: { in: ids } };
  }

  return buildTransactionWhere(userId, selection.filters || {});
}

function eligibilityForAction(action: BulkAction): Prisma.TransactionWhereInput {
  if (action === "restore" || action === "permanent_delete") {
    return { deletedAt: { not: null } };
  }

  if (action === "soft_delete") {
    return { deletedAt: null };
  }

  return { deletedAt: null };
}

function updateDataForAction(action: BulkAction, data?: BulkInput["data"]): Prisma.TransactionUpdateManyMutationInput {
  if (action === "assign_category") {
    if (!data?.categoryId) throw new Error("categoryId is required for assign_category");
    return { categoryId: data.categoryId };
  }

  if (action === "clear_category") {
    return { categoryId: null };
  }

  if (action === "soft_delete") {
    return { deletedAt: new Date() };
  }

  if (action === "restore") {
    return { deletedAt: null };
  }

  throw new Error("permanent_delete does not use updateMany payload");
}

export async function applyBulkTransactionAction(input: BulkInput) {
  if (input.action === "assign_category") {
    const category = await prisma.category.findFirst({
      where: {
        id: input.data?.categoryId || "",
        userId: input.userId,
        archivedAt: null
      }
    });
    if (!category) throw new Error("Target category is invalid or archived");
  }

  const baseWhere = baseWhereForSelection(input.userId, input.selection);
  const eligibleWhere: Prisma.TransactionWhereInput = {
    AND: [baseWhere, eligibilityForAction(input.action)]
  };

  const matchedCount = await prisma.transaction.count({ where: baseWhere });

  if (input.action === "permanent_delete") {
    const eligible = await prisma.transaction.findMany({
      where: eligibleWhere,
      select: { id: true }
    });
    const eligibleIds = eligible.map((row) => row.id);

    if (eligibleIds.length > 0) {
      await prisma.$transaction([
        prisma.importedTransaction.updateMany({
          where: { transactionId: { in: eligibleIds } },
          data: { transactionId: null }
        }),
        prisma.transaction.deleteMany({
          where: { id: { in: eligibleIds }, userId: input.userId, deletedAt: { not: null } }
        })
      ]);
    }

    return {
      matchedCount,
      updatedCount: eligibleIds.length,
      skippedCount: Math.max(0, matchedCount - eligibleIds.length)
    };
  }

  const updated = await prisma.transaction.updateMany({
    where: eligibleWhere,
    data: updateDataForAction(input.action, input.data)
  });

  return {
    matchedCount,
    updatedCount: updated.count,
    skippedCount: Math.max(0, matchedCount - updated.count)
  };
}

export type { BulkAction, Selection };
