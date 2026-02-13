import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DeleteCategoryInput = {
  userId: string;
  categoryId: string;
  strategy: "reassign" | "uncategorized";
  targetCategoryId?: string;
  childStrategy?: "reassign" | "archive" | "block";
  childTargetCategoryId?: string;
};

type CategoryTx = Prisma.TransactionClient;

export async function ensureUncategorizedCategory(tx: CategoryTx, userId: string) {
  const existing = await tx.category.findFirst({
    where: { userId, slug: "uncategorized" }
  });

  if (existing) {
    if (!existing.isSystem || existing.level !== 1) {
      return tx.category.update({
        where: { id: existing.id },
        data: { isSystem: true, level: 1, parentId: null, archivedAt: null }
      });
    }

    if (existing.archivedAt) {
      return tx.category.update({ where: { id: existing.id }, data: { archivedAt: null } });
    }

    return existing;
  }

  return tx.category.create({
    data: {
      userId,
      name: "Uncategorized",
      slug: "uncategorized",
      level: 1,
      isSystem: true
    }
  });
}

export async function getCategoryImpactCounts(userId: string, categoryId: string) {
  const [transactions, rules, importRows, childCategories] = await Promise.all([
    prisma.transaction.count({ where: { userId, categoryId } }),
    prisma.classificationRule.count({ where: { userId, categoryId } }),
    prisma.importedTransaction.count({ where: { importJob: { userId }, proposedCategoryId: categoryId } }),
    prisma.category.count({ where: { userId, parentId: categoryId } })
  ]);

  return { transactions, rules, importRows, childCategories };
}

export async function archiveCategory(userId: string, categoryId: string, archived: boolean) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) throw new Error("Category not found");
  if (category.isSystem && !archived) {
    return category;
  }
  if (category.isSystem && archived) {
    throw new Error("System category cannot be archived");
  }

  return prisma.category.update({
    where: { id: categoryId },
    data: { archivedAt: archived ? new Date() : null }
  });
}

export async function deleteCategoryWithStrategy(input: DeleteCategoryInput) {
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.findFirst({
      where: { id: input.categoryId, userId: input.userId },
      include: { children: true }
    });

    if (!category) throw new Error("Category not found");
    if (category.isSystem) throw new Error("System category cannot be deleted");

    let targetCategoryId: string;

    if (input.strategy === "uncategorized") {
      const uncategorized = await ensureUncategorizedCategory(tx, input.userId);
      targetCategoryId = uncategorized.id;
    } else {
      if (!input.targetCategoryId) throw new Error("Target category is required for reassign strategy");
      const target = await tx.category.findFirst({
        where: { id: input.targetCategoryId, userId: input.userId, archivedAt: null }
      });
      if (!target) throw new Error("Reassign target category is invalid");
      targetCategoryId = target.id;
    }

    if (category.children.length > 0) {
      if (!input.childStrategy || input.childStrategy === "block") {
        throw new Error("This category has child subcategories. Choose a child handling strategy.");
      }

      if (input.childStrategy === "archive") {
        await tx.category.updateMany({
          where: { parentId: category.id, userId: input.userId },
          data: { archivedAt: new Date(), parentId: null }
        });
      }

      if (input.childStrategy === "reassign") {
        if (!input.childTargetCategoryId) {
          throw new Error("Child target category is required for child reassign strategy");
        }

        const childTarget = await tx.category.findFirst({
          where: {
            id: input.childTargetCategoryId,
            userId: input.userId,
            archivedAt: null,
            level: 1
          }
        });

        if (!childTarget) {
          throw new Error("Child target major category is invalid");
        }

        await tx.category.updateMany({
          where: { parentId: category.id, userId: input.userId },
          data: { parentId: childTarget.id }
        });
      }
    }

    await tx.transaction.updateMany({
      where: { userId: input.userId, categoryId: category.id },
      data: { categoryId: targetCategoryId }
    });

    await tx.classificationRule.updateMany({
      where: { userId: input.userId, categoryId: category.id },
      data: { categoryId: targetCategoryId }
    });

    await tx.importedTransaction.updateMany({
      where: { importJob: { userId: input.userId }, proposedCategoryId: category.id },
      data: { proposedCategoryId: targetCategoryId }
    });

    await tx.category.delete({ where: { id: category.id } });

    return {
      deletedCategoryId: category.id,
      reassignedToCategoryId: targetCategoryId
    };
  });
}
