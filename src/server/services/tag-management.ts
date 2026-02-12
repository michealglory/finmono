import { prisma } from "@/lib/prisma";

export async function getTagImpactCounts(userId: string, tagId: string) {
  const [transactions, lineItems] = await Promise.all([
    prisma.transactionTag.count({ where: { tagId, transaction: { userId } } }),
    prisma.lineItemTag.count({ where: { tagId, lineItem: { transaction: { userId } } } })
  ]);

  return { transactions, lineItems };
}

export async function deleteTag(userId: string, tagId: string) {
  return prisma.$transaction(async (tx) => {
    const tag = await tx.tag.findFirst({ where: { id: tagId, userId } });
    if (!tag) throw new Error("Tag not found");

    await tx.transactionTag.deleteMany({ where: { tagId } });
    await tx.lineItemTag.deleteMany({ where: { tagId } });
    await tx.tag.delete({ where: { id: tagId } });

    return { deletedTagId: tagId };
  });
}

export async function mergeTag(userId: string, sourceTagId: string, targetTagId: string) {
  if (sourceTagId === targetTagId) throw new Error("Source and target tags must differ");

  return prisma.$transaction(async (tx) => {
    const [source, target] = await Promise.all([
      tx.tag.findFirst({ where: { id: sourceTagId, userId } }),
      tx.tag.findFirst({ where: { id: targetTagId, userId } })
    ]);

    if (!source || !target) throw new Error("Source/target tag not found");

    const sourceTxTags = await tx.transactionTag.findMany({ where: { tagId: sourceTagId } });
    if (sourceTxTags.length > 0) {
      await tx.transactionTag.createMany({
        data: sourceTxTags.map((row) => ({ transactionId: row.transactionId, tagId: targetTagId })),
        skipDuplicates: true
      });
    }

    const sourceLineItemTags = await tx.lineItemTag.findMany({ where: { tagId: sourceTagId } });
    if (sourceLineItemTags.length > 0) {
      await tx.lineItemTag.createMany({
        data: sourceLineItemTags.map((row) => ({ lineItemId: row.lineItemId, tagId: targetTagId })),
        skipDuplicates: true
      });
    }

    await tx.transactionTag.deleteMany({ where: { tagId: sourceTagId } });
    await tx.lineItemTag.deleteMany({ where: { tagId: sourceTagId } });
    await tx.tag.delete({ where: { id: sourceTagId } });

    return { mergedFromTagId: sourceTagId, mergedIntoTagId: targetTagId };
  });
}

export async function ensureTagsByNames(userId: string, names: string[]) {
  const normalized = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (normalized.length === 0) return [];

  return prisma.$transaction(async (tx) => {
    const ids: string[] = [];

    for (const name of normalized) {
      const existing = await tx.tag.findFirst({ where: { userId, name } });
      if (existing) {
        ids.push(existing.id);
        continue;
      }

      const created = await tx.tag.create({ data: { userId, name } });
      ids.push(created.id);
    }

    return ids;
  });
}
