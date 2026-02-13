import { Direction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildTransactionWhere, type TransactionFilterInput } from "@/server/services/transaction-filters";

type BulkAction = "assign_category" | "clear_category" | "soft_delete" | "restore";

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
  if (action === "restore") {
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

  return { deletedAt: null };
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

  const [matchedCount, updated] = await prisma.$transaction([
    prisma.transaction.count({ where: baseWhere }),
    prisma.transaction.updateMany({
      where: eligibleWhere,
      data: updateDataForAction(input.action, input.data)
    })
  ]);

  return {
    matchedCount,
    updatedCount: updated.count,
    skippedCount: Math.max(0, matchedCount - updated.count)
  };
}

export type { BulkAction, Selection };
